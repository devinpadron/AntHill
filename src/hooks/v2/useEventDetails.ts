import { useCallback, useEffect, useMemo, useState } from "react";
import {
	setEventResponse,
	subscribeEvent,
	subscribeEventResponses,
	updateEvent,
} from "../../services/v2/eventService";
import { subscribeAttachments } from "../../services/v2/attachmentService";
import {
	getChecklistsByIds,
	getPackagesByIds,
	subscribeEventLabels,
} from "../../services/v2/libraryService";
import {
	Attachment,
	Event,
	EventResponseStatus,
	Checklist,
	EventLabel,
	Package,
} from "../../types/v2";
import { useCompanyMembers } from "./useCompanyMembers";
import { useUser } from "../../contexts/v2/UserContext";
import { useCompany } from "../../contexts/v2/CompanyContext";

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
	const [responses, setResponses] = useState<Record<string, string>>({});
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
		return subscribeEventResponses(companyId, eventId, setResponses);
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
	 * Admins always edit; everyone else only when the company allows it AND
	 * they are actually on the event. The rules enforce the narrower version of
	 * this (workerNotes only), so this is a UI affordance, not the guard.
	 */
	const hasEditPermission = Boolean(
		isAdmin ||
		(preferences.allowUserEventEditing &&
			event?.assignedUserIds?.includes(userId)),
	);

	const myResponse = (responses[userId] ?? "pending") as EventResponseStatus;

	return {
		user,
		event,
		attachments,
		packages,
		eventLabel,
		responses,
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
