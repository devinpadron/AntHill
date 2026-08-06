import { useEffect, useMemo, useState } from "react";
import {
	subscribeEventsInRange,
	subscribeMyResponseDocs,
	subscribeMyUpcomingEvents,
} from "../services/eventService";
import { Event, EventResponse, FilterType } from "../types";
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
	const { companyId, userId, membership } = useUser();
	const { preferences } = useCompany();

	const [events, setEvents] = useState<Event[]>([]);
	const [responses, setResponses] = useState<Record<string, EventResponse>>(
		{},
	);
	const [unstaffed, setUnstaffed] = useState<Event[]>([]);

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
	 * Upcoming jobs with nobody on the crew yet.
	 *
	 * This is the set the Availability screen draws from, and the reason the
	 * badge showed nothing before: most of those jobs are OPEN, and an open job
	 * has no response document until somebody answers it. Counting response
	 * documents alone therefore reported zero for any company that does not
	 * publish to groups — which is most of them.
	 *
	 * Unassigned rather than merely open, so the two are one subscription, and
	 * so a job that has since been STAFFED drops out. Otherwise a worker who
	 * never answered an invitation would carry that badge forever, pointing at
	 * a screen that had stopped listing the job.
	 */
	const restricted = membership?.visibility === "restricted";

	useEffect(() => {
		if (!enabled) {
			setUnstaffed([]);
			return;
		}
		return subscribeEventsInRange(
			companyId!,
			{ from, filter: FilterType.UNASSIGNED, userId },
			setUnstaffed,
			() => setUnstaffed([]),
		);
	}, [enabled, companyId, userId, from]);

	/*
	 * The subscriptions run regardless; only the COUNTS are gated on
	 * preferences. Gating the queries instead would mean a company toggling a
	 * setting had to remount two listeners to see a badge change.
	 */
	const requireAck = preferences.requireAssignmentAcknowledgement !== false;

	/*
	 * The badge follows the "Chase unanswered availability" setting.
	 *
	 * Deliberately the same switch that turns on the push reminders rather than
	 * a separate one: a company that has decided not to chase people about
	 * unanswered jobs has decided not to nag them, and a permanent red count on
	 * the tab is a nag that never goes away.
	 */
	const chaseOn = Boolean(
		preferences.enableAvailability &&
		preferences.availabilityReminder?.enabled,
	);

	/** Assigned, upcoming, and not yet confirmed as seen. */
	const unconfirmed = useMemo(() => {
		if (!requireAck) return [];
		return events.filter((event) => {
			const response = responses[event.id];
			// No response document yet means nothing has been acknowledged.
			if (!response) return true;
			return !response.acknowledgedAt;
		});
	}, [events, responses, requireAck]);

	/** Ids, for a list that wants to mark rows without scanning an array. */
	const unconfirmedIds = useMemo(
		() => new Set(unconfirmed.map((event) => event.id)),
		[unconfirmed],
	);

	/*
	 * Jobs still awaiting an answer, matching what the Availability screen
	 * lists: open jobs nobody has replied to, plus invitations still pending.
	 *
	 * Assignment is what separates the two questions, so anything I am on the
	 * crew for is excluded — once the shift is mine, "can you work this" is no
	 * longer the question being asked.
	 *
	 * Counted as a SET so the number can never exceed the list it points at.
	 */
	const awaitingReply = useMemo(() => {
		if (!chaseOn) return 0;

		const assigned = new Set(events.map((event) => event.id));
		const ids = new Set<string>();

		for (const event of unstaffed) {
			// On the crew already: a different question entirely.
			if (assigned.has(event.id)) continue;

			/*
			 * A response document means they were invited — or have answered
			 * before. Targeted jobs are visible only to the invited, and a
			 * restricted worker sees nothing else at all.
			 */
			const mine = responses[event.id];
			const invited = Boolean(mine);
			if (event.isTargeted && !invited) continue;
			if (restricted && !invited) continue;

			// Answered either way is answered; only "pending" still needs one.
			if (mine?.status === "confirmed" || mine?.status === "declined") {
				continue;
			}

			ids.add(event.id);
		}

		return ids.size;
	}, [events, unstaffed, responses, restricted, chaseOn]);

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
