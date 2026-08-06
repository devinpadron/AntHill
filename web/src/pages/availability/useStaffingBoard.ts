import { useCallback, useEffect, useMemo, useState } from "react";
import {
	getEventResponses,
	setEventResponse,
	subscribeEventsInRange,
	updateEvent,
} from "@app/services/eventService";
import { useCompanyMembers } from "@app/hooks/useCompanyMembers";
import { useGroups } from "@app/hooks/useGroups";
import { FilterType } from "@app/types/enums/FilterType";
import { Role } from "@app/types/enums/Role";
import type { Event, EventResponseStatus, Membership } from "@app/types";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";

/*
 * The staffing board's data.
 *
 * Events across the top, workers down the side, one cell per pair. Everything
 * here exists to answer the question a phone cannot put on one screen: for the
 * next month, who is confirmed, who has not answered, and who cannot even SEE
 * the job they were expected to reply to.
 *
 * Responses are fetched per event in parallel on window change, then the
 * focused column keeps a live subscription. The plan's alternative — a single
 * company-wide response listener — needs a new service function and a new
 * index, and is deliberately deferred until a real window proves it necessary.
 * At the default 30 days that is ~20 reads, which is nothing.
 */

export type CellState =
	| "confirmed"
	| "declined"
	| "pending"
	| "not-invited"
	/** Restricted worker, outside this event's audience — cannot see it at all. */
	| "not-visible";

export type Cell = {
	state: CellState;
	/** Orthogonal to the response: on the crew, whatever they answered. */
	assigned: boolean;
	/** Assigned or confirmed on another event the same day. */
	conflict: boolean;
};

export type BoardRow = {
	member: Membership;
	cells: Cell[];
	confirmed: number;
	pending: number;
	declined: number;
	assigned: number;
};

export type BoardColumn = {
	event: Event;
	confirmed: number;
	pending: number;
	declined: number;
	assigned: number;
};

/**
 * Can this worker see this event at all?
 *
 * Mirrors the visibility rule eventService.getAvailabilityEvents applies when a
 * worker asks for their own list: `open` workers see anything untargeted, plus
 * anything they are named in; `restricted` workers see only what they are
 * invited to. Managers and owners see everything.
 *
 * Surfacing this is the board's most useful trick — "they never replied" and
 * "the job was never visible to them" look identical on a phone.
 */
function canSee(member: Membership, event: Event): boolean {
	if (member.role === Role.MANAGER || member.role === Role.OWNER) return true;

	const namedDirectly = (event.audienceUserIds ?? []).includes(member.userId);
	if (namedDirectly) return true;

	const inAudienceGroup = (event.audienceGroupIds ?? []).some((groupId) =>
		(member.groupIds ?? []).includes(groupId),
	);
	if (inAudienceGroup) return true;

	if (event.isTargeted) return false;
	return (member.visibility ?? "open") === "open";
}

export function useStaffingBoard(from: string, to: string) {
	const { companyId } = useCompany();
	const { userId } = useAuth();
	const { members } = useCompanyMembers(companyId);
	const { groups } = useGroups(companyId);

	const [events, setEvents] = useState<Event[]>([]);
	const [responses, setResponses] = useState<
		Record<string, Record<string, string>>
	>({});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		setIsLoading(true);
		setError(null);
		const unsubscribe = subscribeEventsInRange(
			companyId,
			{ from, to, filter: FilterType.ALL },
			(next) => {
				setEvents(
					[...next].sort((a, b) => {
						if (a.dateKey !== b.dateKey)
							return a.dateKey.localeCompare(b.dateKey);
						return (
							(a.startAt?.toMillis?.() ?? 0) -
							(b.startAt?.toMillis?.() ?? 0)
						);
					}),
				);
				setIsLoading(false);
			},
			(queryError) => {
				// A missing composite index arrives here. Showing it beats an
				// empty grid that looks like "no events".
				setError(queryError);
				setIsLoading(false);
			},
		);
		return unsubscribe;
	}, [companyId, from, to]);

	/* ---- responses, one read per event, in parallel ---- */
	const eventIds = useMemo(() => events.map((e) => e.id).join(","), [events]);

	useEffect(() => {
		if (!events.length) {
			setResponses({});
			return;
		}
		let live = true;
		Promise.all(
			events.map((event) =>
				getEventResponses(companyId, event.id)
					.then((map) => [event.id, map] as const)
					.catch(() => [event.id, {}] as const),
			),
		).then((pairs) => {
			if (live) setResponses(Object.fromEntries(pairs));
		});
		return () => {
			live = false;
		};
	}, [companyId, eventIds]);

	/* ---- who is booked on what day, for conflict detection ---- */
	const bookedByDay = useMemo(() => {
		const map = new Map<string, Map<string, string[]>>();
		for (const event of events) {
			const day = map.get(event.dateKey) ?? new Map<string, string[]>();
			for (const assignedId of event.assignedUserIds ?? []) {
				day.set(assignedId, [...(day.get(assignedId) ?? []), event.id]);
			}
			map.set(event.dateKey, day);
		}
		return map;
	}, [events]);

	const activeMembers = useMemo(
		() => members.filter((m) => m.status === "active"),
		[members],
	);

	const rows = useMemo<BoardRow[]>(
		() =>
			activeMembers.map((member) => {
				const cells = events.map<Cell>((event) => {
					const status = responses[event.id]?.[member.userId] as
						EventResponseStatus | undefined;
					const assigned = (event.assignedUserIds ?? []).includes(
						member.userId,
					);

					const state: CellState = status
						? (status as CellState)
						: canSee(member, event)
							? "not-invited"
							: "not-visible";

					const sameDay =
						bookedByDay.get(event.dateKey)?.get(member.userId) ??
						[];
					return {
						state,
						assigned,
						conflict:
							sameDay.length > 1 ||
							(sameDay.length === 1 &&
								!sameDay.includes(event.id)),
					};
				});

				return {
					member,
					cells,
					confirmed: cells.filter((c) => c.state === "confirmed")
						.length,
					pending: cells.filter((c) => c.state === "pending").length,
					declined: cells.filter((c) => c.state === "declined")
						.length,
					assigned: cells.filter((c) => c.assigned).length,
				};
			}),
		[activeMembers, events, responses, bookedByDay],
	);

	const columns = useMemo<BoardColumn[]>(
		() =>
			events.map((event, index) => {
				const column = rows.map((row) => row.cells[index]);
				return {
					event,
					confirmed: column.filter((c) => c?.state === "confirmed")
						.length,
					pending: column.filter((c) => c?.state === "pending")
						.length,
					declined: column.filter((c) => c?.state === "declined")
						.length,
					assigned: column.filter((c) => c?.assigned).length,
				};
			}),
		[events, rows],
	);

	/** Manager-on-behalf response. The same write the app's roster sheet makes. */
	const setResponse = useCallback(
		async (
			event: Event,
			targetUserId: string,
			status: EventResponseStatus,
		) => {
			await setEventResponse(
				companyId,
				event.id,
				targetUserId,
				status,
				event.dateKey,
			);
			// Optimistic, so a grid of cells does not wait on a round trip each.
			setResponses((current) => ({
				...current,
				[event.id]: { ...current[event.id], [targetUserId]: status },
			}));
		},
		[companyId],
	);

	const toggleAssigned = useCallback(
		async (event: Event, targetUserId: string) => {
			const current = event.assignedUserIds ?? [];
			const next = current.includes(targetUserId)
				? current.filter((id) => id !== targetUserId)
				: [...current, targetUserId];
			await updateEvent(event.id, { assignedUserIds: next }, userId);
		},
		[userId],
	);

	return {
		rows,
		columns,
		events,
		groups,
		isLoading,
		error,
		setResponse,
		toggleAssigned,
	};
}
