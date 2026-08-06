import { useCallback, useEffect, useMemo, useState } from "react";
import {
	getEventsInRange,
	setEventResponse,
	subscribeEvent,
	subscribeEventResponseDocs,
	updateEvent,
} from "@app/services/eventService";
import { subscribeAttachments } from "@app/services/attachmentService";
import {
	getChecklistsByIds,
	getPackagesByIds,
	subscribeEventLabels,
} from "@app/services/libraryService";
import { useCompanyMembers } from "@app/hooks/useCompanyMembers";
import { FilterType } from "@app/types/enums/FilterType";
import type {
	Attachment,
	Checklist,
	Event,
	EventLabel,
	EventResponse,
	EventResponseStatus,
	Membership,
	Package,
} from "@app/types";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";

/*
 * One event, for the detail drawer.
 *
 * A web rewrite of ../../src/hooks/useEventDetails.ts rather than a reuse: that
 * hook reads `useUser()` and `useCompany()` from the app's contexts, which carry
 * @react-native-firebase/auth and AsyncStorage. Every SERVICE call below is the
 * same one it makes, so the reads and writes are identical — only the source of
 * userId/companyId differs.
 *
 * It adds one thing the app's version has no room to show: DOUBLE BOOKINGS.
 * Every roster row knows whether that worker is also assigned to another event
 * the same day. On a phone you would have to leave the screen and check each
 * person's calendar; here it is a flag in the row you are already reading.
 */

export type RosterRow = {
	member: Membership;
	/** The availability answer — "can you work this?" */
	status: EventResponseStatus | null;
	/** The assignment answer — "I see I am working this." Independent. */
	acknowledged: boolean;
	/** Set when they said they cannot work it after all. Never unassigns. */
	problem: { at: Date | null; note: string | null } | null;
	/** Other events the same day this worker is also assigned to. */
	conflicts: Event[];
};

export function useEventDrawer(eventId: string) {
	const { companyId } = useCompany();
	const { userId } = useAuth();
	const { members, byUserId } = useCompanyMembers(companyId);

	const [event, setEvent] = useState<Event | null>(null);
	const [responses, setResponses] = useState<Record<string, EventResponse>>(
		{},
	);
	const [attachments, setAttachments] = useState<Attachment[]>([]);
	const [labels, setLabels] = useState<EventLabel[]>([]);
	const [packages, setPackages] = useState<Package[]>([]);
	const [checklists, setChecklists] = useState<Record<string, Checklist>>({});
	const [sameDay, setSameDay] = useState<Event[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	useEffect(() => {
		setIsLoading(true);
		setNotFound(false);
		return subscribeEvent(eventId, (next) => {
			setEvent(next);
			// A deleted event, or one this admin cannot read, both arrive as
			// null. Either way the drawer should say so rather than sit empty.
			if (!next) setNotFound(true);
			setIsLoading(false);
		});
	}, [eventId]);

	useEffect(
		() => subscribeEventResponseDocs(companyId, eventId, setResponses),
		[companyId, eventId],
	);

	useEffect(
		() => subscribeAttachments(companyId, "event", eventId, setAttachments),
		[companyId, eventId],
	);

	useEffect(() => subscribeEventLabels(companyId, setLabels), [companyId]);

	// Packages and their checklists — resolved in two batched reads rather
	// than one per id, the same shape libraryService is built for.
	useEffect(() => {
		if (!event?.packageIds?.length) {
			setPackages([]);
			return;
		}
		let live = true;
		getPackagesByIds(companyId, event.packageIds)
			.then((found) => live && setPackages(found))
			.catch(() => live && setPackages([]));
		return () => {
			live = false;
		};
	}, [companyId, event?.packageIds]);

	useEffect(() => {
		if (!event?.checklistIds?.length) {
			setChecklists({});
			return;
		}
		let live = true;
		getChecklistsByIds(companyId, event.checklistIds)
			.then((found) => live && setChecklists(found))
			.catch(() => live && setChecklists({}));
		return () => {
			live = false;
		};
	}, [companyId, event?.checklistIds]);

	/*
	 * Every event on the same calendar day, so the roster can flag someone
	 * booked twice. One query for the day, not one per worker.
	 */
	useEffect(() => {
		if (!event?.dateKey) return;
		let live = true;
		getEventsInRange(companyId, {
			from: event.dateKey,
			to: event.dateKey,
			filter: FilterType.ALL,
		})
			.then((found) => live && setSameDay(found))
			.catch(() => live && setSameDay([]));
		return () => {
			live = false;
		};
	}, [companyId, event?.dateKey]);

	const roster = useMemo<RosterRow[]>(() => {
		if (!event) return [];
		return (event.assignedUserIds ?? []).map((assignedId) => {
			const member = byUserId?.[assignedId];
			const response = responses[assignedId];
			return {
				member:
					member ??
					({
						id: assignedId,
						userId: assignedId,
						firstName: "Unknown",
						lastName: "worker",
					} as Membership),
				status: response?.status ?? null,
				acknowledged: Boolean(response?.acknowledgedAt),
				problem: response?.problemFlaggedAt
					? {
							at: response.problemFlaggedAt.toDate?.() ?? null,
							note: response.problemNote ?? null,
						}
					: null,
				conflicts: sameDay.filter(
					(other) =>
						other.id !== event.id &&
						(other.assignedUserIds ?? []).includes(assignedId),
				),
			};
		});
	}, [event, byUserId, responses, sameDay]);

	/** Invited but not assigned — they can answer without being on the crew. */
	const invitedOnly = useMemo(() => {
		if (!event) return [];
		const assigned = new Set(event.assignedUserIds ?? []);
		return Object.keys(responses)
			.filter((id) => !assigned.has(id))
			.map((id) => ({
				member: byUserId?.[id],
				status: responses[id]?.status as EventResponseStatus,
			}))
			.filter((row) => row.member);
	}, [event, responses, byUserId]);

	const setResponse = useCallback(
		async (targetUserId: string, status: EventResponseStatus) => {
			if (!event) return;
			// The same manager-on-behalf write the app's availability sheet
			// makes; firestore.rules permits it for a manager.
			await setEventResponse(
				companyId,
				event.id,
				targetUserId,
				status,
				event.dateKey,
			);
		},
		[companyId, event],
	);

	const saveAdminNotes = useCallback(
		async (notes: string) => {
			if (!event) return;
			// A field patch, never a whole-document write — v1 spread the
			// entire event back and clobbered concurrent edits.
			await updateEvent(event.id, { adminNotes: notes }, userId);
		},
		[event, userId],
	);

	const label = useMemo(
		() =>
			event?.labelId
				? (labels.find((l) => l.id === event.labelId) ?? null)
				: null,
		[labels, event?.labelId],
	);

	return {
		event,
		label,
		roster,
		invitedOnly,
		attachments,
		packages,
		checklists,
		members,
		byUserId,
		isLoading,
		notFound,
		setResponse,
		saveAdminNotes,
	};
}
