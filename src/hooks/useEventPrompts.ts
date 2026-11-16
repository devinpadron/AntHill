import { useEffect, useMemo, useState } from "react";
import {
	subscribeEventsInRange,
	subscribeMyResponseDocs,
	subscribeMyUpcomingEvents,
} from "../services/eventService";
import { subscribeMyPendingTasks } from "../services/eventTaskService";
import { Event, EventResponse, EventTask, FilterType } from "../types";
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
 * A THIRD question joined them later: event tasks ("have you made the final
 * call with the client"). Those live in their own collection, already narrowed
 * server-side to the ones still pending on this user, so they are one more
 * subscription rather than something derived from the first two.
 *
 * Admins are INCLUDED. They were excluded on the reasoning that a manager who
 * assigns themselves already knows they did — but the same exclusion also took
 * away their confirm button, so a manager on their own crew showed as
 * unconfirmed to everyone else and had no way to fix it. One rule for everyone
 * on the crew is both simpler to explain and the one the screen can honour.
 */

/** Local YYYY-MM-DD. toISOString would shift the day in most time zones. */
function dateKeyOf(date: Date): string {
	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, "0"),
		String(date.getDate()).padStart(2, "0"),
	].join("-");
}

const todayKey = () => dateKeyOf(new Date());

/*
 * How far back the task query reaches.
 *
 * A task can fall due after its event — "return the van keys" — so asking for
 * today onwards would drop exactly the overdue ones. Tasks stop being chased
 * TASK_EXPIRY_SECONDS (7 days) after the event ends; one day more than that
 * covers an event that ran past midnight. Anything the floor lets through
 * that has since expired is filtered out below.
 */
const TASK_LOOKBACK_DAYS = 8;

function taskFloorKey(): string {
	const floor = new Date();
	floor.setDate(floor.getDate() - TASK_LOOKBACK_DAYS);
	return dateKeyOf(floor);
}

export function useEventPrompts() {
	const { companyId, userId, membership } = useUser();
	const { preferences } = useCompany();

	const [events, setEvents] = useState<Event[]>([]);
	const [responses, setResponses] = useState<Record<string, EventResponse>>(
		{},
	);
	const [unstaffed, setUnstaffed] = useState<Event[]>([]);
	const [myTasks, setMyTasks] = useState<EventTask[]>([]);

	const from = todayKey();
	const taskFrom = taskFloorKey();
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

	useEffect(() => {
		if (!enabled) {
			setMyTasks([]);
			return;
		}
		return subscribeMyPendingTasks(
			companyId!,
			userId,
			taskFrom,
			setMyTasks,
			// A missing index must read as "no tasks", not as a stale list.
			() => setMyTasks([]),
		);
	}, [enabled, companyId, userId, taskFrom]);

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

	/*
	 * Tasks this worker still owes, soonest due first.
	 *
	 * Gated on the company flag for the same reason the availability count
	 * follows its setting: a company that switched tasks off has decided not
	 * to ask, and a badge that cannot be cleared from any visible screen is
	 * the worst kind of nag.
	 */
	const tasksOn = Boolean(preferences.enableEventTasks);

	const pendingTasks = useMemo(() => {
		if (!tasksOn) return [];
		const now = Date.now();
		return myTasks
			.filter((task) => {
				const expires = task.expiresAt?.toMillis?.();
				return expires === undefined || expires > now;
			})
			.sort(
				(a, b) =>
					(a.dueAt?.toMillis?.() ?? 0) - (b.dueAt?.toMillis?.() ?? 0),
			);
	}, [myTasks, tasksOn]);

	/** Event ids with a task outstanding, for marking rows in a list. */
	const pendingTaskEventIds = useMemo(
		() => new Set(pendingTasks.map((task) => task.eventId)),
		[pendingTasks],
	);

	return {
		/** Event tasks still pending on this worker. */
		pendingTasks,
		pendingTaskEventIds,
		pendingTaskCount: pendingTasks.length,
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
