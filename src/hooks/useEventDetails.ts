import { useCallback, useEffect, useMemo, useState } from "react";
import {
	acknowledgeAssignment,
	flagAssignmentProblem,
	setEventResponse,
	subscribeEvent,
	subscribeEventResponseDocs,
	updateEvent,
} from "../services/eventService";
import { subscribeAttachments } from "../services/attachmentService";
import {
	getChecklistsByIds,
	getPackagesByIds,
	subscribeEventLabels,
} from "../services/libraryService";
import {
	Attachment,
	Event,
	EventResponse,
	EventResponseStatus,
	Checklist,
	EventLabel,
	Package,
} from "../types";
import { useCompanyMembers } from "./useCompanyMembers";
import { useUser } from "../contexts/UserContext";
import { useCompany } from "../contexts/CompanyContext";

/*
 * A single event.
 *
 * Worker names come from useCompanyMembers rather than a getUser() per assigned
 * worker, and notes save as a field patch rather than writing the whole event
 * document back — v1's saveNotes spread `{...event, userNotes}`, which
 * clobbered any concurrent admin edit and is now rejected by the rules anyway.
 */

export function useEventDetails(eventId: string) {
	const { userId, companyId, isAdmin, user } = useUser();
	const { preferences } = useCompany();

	const [event, setEvent] = useState<Event | null>(null);
	const [attachments, setAttachments] = useState<Attachment[]>([]);
	/*
	 * Packages carry `checklistIds`; the UI wants the checklists themselves.
	 * They are resolved in ONE batched query for all packages, then attached —
	 * v1 fetched a package at a time, each of which fetched its checklists one
	 * at a time.
	 */
	const [packages, setPackages] = useState<
		(Package & { checklists: Checklist[] })[]
	>([]);
	const [responseDocs, setResponseDocs] = useState<
		Record<string, EventResponse>
	>({});
	const [labels, setLabels] = useState<EventLabel[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Local draft so typing does not fight the live subscription.
	const [localNotes, setLocalNotes] = useState("");

	const { namesFor, byUserId } = useCompanyMembers(companyId ?? "");

	useEffect(() => {
		if (!eventId) return;
		setIsLoading(true);
		return subscribeEvent(eventId, (next) => {
			setEvent(next);
			setIsLoading(false);
		});
	}, [eventId]);

	// Seed the draft once, and again if the remote value changes while the
	// field is untouched.
	useEffect(() => {
		setLocalNotes(event?.workerNotes ?? "");
	}, [event?.workerNotes]);

	useEffect(() => {
		if (!companyId || !eventId) return;
		return subscribeAttachments(
			companyId,
			"event",
			eventId,
			setAttachments,
		);
	}, [companyId, eventId]);

	useEffect(() => {
		if (!companyId || !eventId) return;
		return subscribeEventResponseDocs(companyId, eventId, setResponseDocs);
	}, [companyId, eventId]);

	// One batched query, keyed on the id list rather than the array identity.
	const packageKey = (event?.packageIds ?? []).join(",");
	useEffect(() => {
		if (!companyId || !packageKey) {
			setPackages([]);
			return;
		}
		let cancelled = false;
		(async () => {
			const found = await getPackagesByIds(
				companyId,
				packageKey.split(","),
			);
			const allIds = found.flatMap((pkg) => pkg.checklistIds ?? []);
			const byId = await getChecklistsByIds(companyId, allIds);
			if (cancelled) return;
			setPackages(
				found.map((pkg) => ({
					...pkg,
					checklists: (pkg.checklistIds ?? [])
						.map((id) => byId[id])
						.filter(Boolean),
				})),
			);
		})();
		return () => {
			cancelled = true;
		};
	}, [companyId, packageKey]);

	// Labels are few per company, so one subscription beats a read per event.
	useEffect(() => {
		if (!companyId) return;
		return subscribeEventLabels(companyId, setLabels);
	}, [companyId]);

	const eventLabel = useMemo(
		() => labels.find((l) => l.id === event?.labelId) ?? null,
		[labels, event?.labelId],
	);

	/** Patches only the worker-editable field. */
	const saveNotes = useCallback(async () => {
		if (!eventId || !userId) return;
		await updateEvent(eventId, { workerNotes: localNotes }, userId);
	}, [eventId, userId, localNotes]);

	const respond = useCallback(
		async (status: EventResponseStatus) => {
			if (!event || !userId) return;
			await setEventResponse(
				companyId ?? "",
				event.id,
				userId,
				status,
				event.dateKey,
			);
		},
		[companyId, event, userId],
	);

	const workerNames = useMemo(
		() => namesFor(event?.assignedUserIds ?? []),
		[namesFor, event?.assignedUserIds],
	);

	/** Comma-joined, matching what the v1 screen rendered. */
	const workerList = useMemo(() => workerNames.join(", "), [workerNames]);

	/*
	 * Crew who have said they cannot make it.
	 *
	 * Flagging deliberately does NOT unassign anyone — a mis-tap must never
	 * silently unstaff an event — so the assignment list still reads as full
	 * and nothing else about the event changes. That is exactly why this has to
	 * be surfaced: without it the only trace is a field on a document nobody
	 * opens, and the job turns up short on the day.
	 */
	const flaggedProblems = useMemo(
		() =>
			Object.values(responseDocs)
				.filter(
					(doc) =>
						doc.problemFlaggedAt &&
						event?.assignedUserIds?.includes(doc.userId),
				)
				.map((doc) => ({
					userId: doc.userId,
					name:
						byUserId[doc.userId]?.displayName ??
						"Someone on the crew",
					note: doc.problemNote ?? null,
					at: doc.problemFlaggedAt?.toDate?.() ?? null,
				})),
		[responseDocs, byUserId, event?.assignedUserIds],
	);

	/*
	 * Admins always edit; everyone else only when the company allows it AND
	 * they are actually on the event. The rules enforce the narrower version of
	 * this (workerNotes only), so this is a UI affordance, not the guard.
	 */
	const hasEditPermission = Boolean(
		isAdmin ||
		(preferences.allowUserEventEditing &&
			event?.assignedUserIds?.includes(userId)),
	);

	/*
	 * The flattened status map the roster UI already consumes, derived from the
	 * full documents rather than fetched separately — one listener, both shapes.
	 */
	const responses = useMemo(() => {
		const byUser: Record<string, string> = {};
		for (const [id, doc] of Object.entries(responseDocs)) {
			byUser[id] = doc.status;
		}
		return byUser;
	}, [responseDocs]);

	const myResponse = (responses[userId] ?? "pending") as EventResponseStatus;

	/*
	 * ACKNOWLEDGEMENT — a different question from myResponse above.
	 *
	 *   myResponse       "can you work this?"     asked before assignment
	 *   myAcknowledgement "I see I am working it"  asked after
	 *
	 * Only meaningful when this user is actually on the crew; someone merely
	 * invited has nothing to acknowledge yet.
	 */
	/*
	 * Anyone on the crew is asked, INCLUDING admins.
	 *
	 * This used to be `amAssigned && !isAdmin`, on the reasoning that a manager
	 * who assigns themselves already knows they did. True, but it left them no
	 * button at all — a manager scheduled on their own event could not confirm
	 * it, and so appeared unconfirmed to everyone else looking at the crew. The
	 * question is "are you working this", and it is the same question whoever
	 * is being asked.
	 */
	const amAssigned = Boolean(event?.assignedUserIds?.includes(userId));
	const myDoc = responseDocs[userId];
	const myAcknowledgement = {
		required:
			amAssigned &&
			preferences.requireAssignmentAcknowledgement !== false,
		acknowledged: Boolean(myDoc?.acknowledgedAt),
		problem: myDoc?.problemFlaggedAt
			? {
					at: myDoc.problemFlaggedAt.toDate?.() ?? null,
					note: myDoc.problemNote ?? null,
				}
			: null,
		/** Whether the company lets a worker say they cannot make it. */
		canFlagProblem: Boolean(preferences.allowAssignmentDecline),
	};

	const acknowledge = useCallback(async () => {
		if (!companyId || !event) return;
		await acknowledgeAssignment(companyId, event.id, userId, event.dateKey);
	}, [companyId, event, userId]);

	const flagProblem = useCallback(
		async (note: string) => {
			if (!companyId || !event) return;
			await flagAssignmentProblem(
				companyId,
				event.id,
				userId,
				event.dateKey,
				note,
			);
		},
		[companyId, event, userId],
	);

	return {
		user,
		event,
		attachments,
		packages,
		eventLabel,
		responses,
		myAcknowledgement,
		flaggedProblems,
		acknowledge,
		flagProblem,
		myResponse,
		workerNames,
		workerList,
		membersById: byUserId,
		localNotes,
		setLocalNotes,
		isLoading,
		hasEditPermission,
		saveNotes,
		respond,
	};
}
