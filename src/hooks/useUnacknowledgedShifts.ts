import { useEffect, useMemo, useState } from "react";
import {
	subscribeMyResponseDocs,
	subscribeMyUpcomingEvents,
} from "../services/eventService";
import { Event, EventResponse } from "../types";
import { useUser } from "../contexts/UserContext";
import { useCompany } from "../contexts/CompanyContext";

/*
 * Upcoming shifts this worker is assigned to but has not confirmed seeing.
 *
 * Assignment is a statement, not a question — the event simply appears in the
 * worker's list. That is exactly the failure mode this exists to close: a shift
 * can be added to someone's week without them ever registering it.
 *
 * Two subscriptions rather than one, because the two facts live in different
 * documents: which events I am ASSIGNED to is a field on the event, while
 * whether I have ACKNOWLEDGED one is a field on my response document. Both
 * queries already have indexes.
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

export function useUnacknowledgedShifts() {
	const { companyId, userId } = useUser();
	const { preferences } = useCompany();

	const [events, setEvents] = useState<Event[]>([]);
	const [responses, setResponses] = useState<Record<string, EventResponse>>(
		{},
	);

	const from = todayKey();
	/*
	 * Nothing to chase when the company does not ask for acknowledgement — the
	 * badge counts shifts nobody is being prompted about, so it would sit there
	 * permanently with no way to clear it.
	 */
	const enabled = Boolean(
		companyId &&
		userId &&
		preferences.requireAssignmentAcknowledgement !== false,
	);

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

	const pending = useMemo(
		() =>
			events.filter((event) => {
				const response = responses[event.id];
				// No response document yet means nothing has been acknowledged.
				// A flagged problem also counts as unresolved, so the prompt
				// stays until the worker either confirms or an admin acts.
				if (!response) return true;
				return !response.acknowledgedAt && !response.problemFlaggedAt;
			}),
		[events, responses],
	);

	return {
		/** Assigned, upcoming, and not yet confirmed as seen. */
		shifts: pending,
		count: pending.length,
		/** The full response document per event, for a screen showing one. */
		responsesByEventId: responses,
	};
}
