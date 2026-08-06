import { useEffect, useMemo, useState } from "react";
import {
	subscribeMyResponseDocs,
	subscribeMyUpcomingEvents,
} from "../services/eventService";
import { Event, EventResponse } from "../types";
import { useUser } from "../contexts/UserContext";
import { useCompany } from "../contexts/CompanyContext";

/*
 * Everything this worker still owes an answer on, in one place.
 *
 * TWO DIFFERENT QUESTIONS, the same split the server's nudge makes:
 *
 *   unconfirmed   assigned to it, has not confirmed seeing it. Assignment is
 *                 a statement, not a question — the shift simply appears in
 *                 someone's week, and this is what stops it going unnoticed.
 *
 *   awaitingReply invited but not assigned, response still "pending". These
 *                 are the availability screen's events, and answering either
 *                 way is how a worker volunteers or bows out.
 *
 * Two subscriptions, both already indexed, because the facts live in different
 * documents: which events I am ASSIGNED to is a field on the event, while my
 * answer to either question is on my response document. Both counts fall out of
 * the same pair, which is why they are one hook — the Calendar badge, the
 * Availability badge and the per-event warning would otherwise be three
 * screens each opening their own listeners for the same data.
 *
 * Admins are INCLUDED. They were excluded on the reasoning that a manager who
 * assigns themselves already knows they did — but the same exclusion also took
 * away their confirm button, so a manager on their own crew showed as
 * unconfirmed to everyone else and had no way to fix it. One rule for everyone
 * on the crew is both simpler to explain and the one the screen can honour.
 */

/** Local YYYY-MM-DD. toISOString would shift the day in most time zones. */
function todayKey(): string {
	const now = new Date();
	return [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, "0"),
		String(now.getDate()).padStart(2, "0"),
	].join("-");
}

export function useEventPrompts() {
	const { companyId, userId } = useUser();
	const { preferences } = useCompany();

	const [events, setEvents] = useState<Event[]>([]);
	const [responses, setResponses] = useState<Record<string, EventResponse>>(
		{},
	);

	const from = todayKey();
	const enabled = Boolean(companyId && userId);

	useEffect(() => {
		if (!enabled) {
			setEvents([]);
			return;
		}
		return subscribeMyUpcomingEvents(companyId!, userId, from, setEvents);
	}, [enabled, companyId, userId, from]);

	useEffect(() => {
		if (!enabled) {
			setResponses({});
			return;
		}
		return subscribeMyResponseDocs(companyId!, userId, from, setResponses);
	}, [enabled, companyId, userId, from]);

	/*
	 * The subscriptions run regardless; only the COUNTS are gated on
	 * preferences. Gating the queries instead would mean a company toggling a
	 * setting had to remount two listeners to see a badge change.
	 */
	const requireAck = preferences.requireAssignmentAcknowledgement !== false;
	const availabilityOn = Boolean(preferences.enableAvailability);

	/** Assigned, upcoming, and not yet confirmed as seen. */
	const unconfirmed = useMemo(() => {
		if (!requireAck) return [];
		return events.filter((event) => {
			const response = responses[event.id];
			// No response document yet means nothing has been acknowledged. A
			// flagged problem also counts as resolved-enough: the worker has
			// said their piece and it is a manager's move now, so continuing
			// to warn them would be asking them to agree with a shift they
			// have already objected to.
			if (!response) return true;
			return !response.acknowledgedAt && !response.problemFlaggedAt;
		});
	}, [events, responses, requireAck]);

	/** Ids, for a list that wants to mark rows without scanning an array. */
	const unconfirmedIds = useMemo(
		() => new Set(unconfirmed.map((event) => event.id)),
		[unconfirmed],
	);

	/*
	 * Invitations still unanswered.
	 *
	 * Assignment is what separates the two questions, so anything I am on the
	 * crew for is excluded — once the shift is mine, "can you work this" is no
	 * longer the question being asked.
	 */
	const awaitingReply = useMemo(() => {
		if (!availabilityOn) return 0;
		const assigned = new Set(events.map((event) => event.id));
		return Object.values(responses).filter(
			(response) =>
				response.status === "pending" &&
				!assigned.has(response.eventId),
		).length;
	}, [events, responses, availabilityOn]);

	return {
		/** Assigned, upcoming, not yet confirmed. */
		unconfirmed,
		unconfirmedIds,
		unconfirmedCount: unconfirmed.length,
		/** Invitations awaiting a confirm or decline. */
		awaitingReply,
		/** The full response document per event, for a screen showing one. */
		responsesByEventId: responses,
	};
}
