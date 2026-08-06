import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkedDates } from "react-native-calendars/src/types";
import type { EventCursor } from "../services/eventService";
import {
	countEventsInRange,
	EVENT_QUERY_LIMIT,
	getEventPage,
	refineSelection,
	subscribeEventsInRange,
} from "../services/eventService";
import { subscribeEventLabels } from "../services/libraryService";
import { Event, EventLabel } from "../types";
import { FilterType } from "../types/enums/FilterType";

/*
 * The calendar.
 *
 * v1's usePullEvents subscribed to the ENTIRE Events collection and then
 * filtered by assignment (lines 25-89) and by date (91-116) in JavaScript, so
 * every user downloaded every event the company had ever created on every
 * calendar mount — 615 events for the largest company, growing forever.
 *
 * Here the server does the filtering and the window bounds the result. The only
 * JS filtering left is the `allSelected` / `exactSelected` refinement, which
 * Firestore cannot express and which now runs over an already-narrow set.
 */

/** Months of future loaded ahead of the focused month. */
const MONTHS_AFTER = 2;
/** Months of history loaded under the "month" past policy. */
const MONTHS_BEFORE = 1;

/*
 * Where the window starts before anyone asks for more.
 *
 *   "month"  the month before the focused one. A month GRID has to draw every
 *            day of the month it is showing, so it needs the days already gone.
 *   "today"  today. An AGENDA is a list of what is coming; opening it on
 *            history means the first thing you see is the oldest event the
 *            company ever ran, and the next event is somewhere below the fold.
 *
 * "today" reaches backwards only when loadPastEvents is called, and does so a
 * week at a time — small enough that each step is a recognisable amount of
 * schedule rather than an unbounded jump.
 */
export type PastWindow = "month" | "today";

const PAST_STEP_DAYS: Record<PastWindow, number> = {
	month: 365,
	today: 7,
};

export type AgendaItemData = {
	day: string;
	title: string;
	startAt: Date | null;
	endAt: Date | null;
	durationSeconds: number | null;
	isAllDay: boolean;
	assigned: string[];
	uid: string;
	labelId: string | null;
};

export type AgendaItems = Record<string, AgendaItemData[]>;

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for a month offset from a base month. */
function monthKey(base: Date, offsetMonths: number, day: number): string {
	const d = new Date(base.getFullYear(), base.getMonth() + offsetMonths, day);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" for a day offset from a base day. Rolls over months and years. */
function dayKey(base: Date, offsetDays: number): string {
	const d = new Date(
		base.getFullYear(),
		base.getMonth(),
		base.getDate() + offsetDays,
	);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfToday(): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export type UseCalendarEventsOptions = {
	companyId: string;
	userId: string;
	filterType: FilterType;
	selectedUsers?: string[];
	showAllSelectedOnly?: boolean;
	showExactSelectedOnly?: boolean;
	/** Month the calendar is showing; the window is built around it. */
	focusedMonth?: Date;
	/** Where the window starts. Defaults to "month" — see PastWindow. */
	pastWindow?: PastWindow;
	/**
	 * Events per page. Defaults to the whole allowance in one go, which is what
	 * a month grid wants — it draws a bounded range and has nothing to page.
	 * A list should pass something screen-sized and call `loadMore`.
	 */
	pageSize?: number;
};

export function useCalendarEvents({
	companyId,
	userId,
	filterType,
	selectedUsers = [],
	showAllSelectedOnly = false,
	showExactSelectedOnly = false,
	focusedMonth,
	pastWindow = "month",
	pageSize = EVENT_QUERY_LIMIT,
}: UseCalendarEventsOptions) {
	/*
	 * Two sources, merged.
	 *
	 * `livePage` is the first page, held open by a snapshot listener, so the
	 * near-term schedule — the part anyone is looking at — stays current.
	 * `pagedEvents` are the pages fetched after it, read once each.
	 *
	 * Keeping a listener per page would mean an unbounded number of listeners
	 * for a list that is scrolled far enough, and the events furthest from today
	 * are the least likely to change under you. Loaded pages are re-read from
	 * scratch whenever the query itself changes.
	 */
	const [livePage, setLivePage] = useState<Event[]>([]);
	const [pagedEvents, setPagedEvents] = useState<Event[]>([]);
	const [cursor, setCursor] = useState<EventCursor | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);

	const [labels, setLabels] = useState<Record<string, string>>({});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const [pastDays, setPastDays] = useState(0);

	// A stable month anchor: a raw Date in the dependency array would be a new
	// object every render and resubscribe endlessly.
	const anchor = useMemo(() => {
		const base = focusedMonth ?? new Date();
		return new Date(base.getFullYear(), base.getMonth(), 1);
	}, [focusedMonth?.getFullYear(), focusedMonth?.getMonth()]);

	const hasFocusedMonth = Boolean(focusedMonth);

	/*
	 * The first day the window covers, before loadPastEvents extends it.
	 *
	 * Under "today" a focused month that is BEHIND us still wins: the caller
	 * only focuses a month because the user picked a date in it, and returning
	 * nothing for the day they just tapped would be a bug, not restraint.
	 */
	const windowStart = useMemo(() => {
		if (pastWindow === "month") {
			return new Date(
				anchor.getFullYear(),
				anchor.getMonth() - MONTHS_BEFORE,
				1,
			);
		}
		const today = startOfToday();
		return hasFocusedMonth && anchor < today ? anchor : today;
	}, [anchor, pastWindow, hasFocusedMonth]);

	/*
	 * The forward edge.
	 *
	 * Under "month" the window is CLOSED, because a grid draws a bounded range
	 * and needs to know both of its edges.
	 *
	 * Under "today" it is OPEN — `to: undefined`. A fixed end date is what made
	 * a schedule stop dead a few months out no matter how much was booked
	 * beyond it; how far the list reaches should be decided by how far it has
	 * been paged, not by a date chosen in advance.
	 */
	const windowTo = useMemo(
		() =>
			pastWindow === "month"
				? monthKey(anchor, MONTHS_AFTER + 1, 0)
				: undefined,
		[anchor, pastWindow],
	);

	const window = useMemo(
		() => ({ from: dayKey(windowStart, -pastDays), to: windowTo }),
		[windowStart, windowTo, pastDays],
	);

	// Serialized so the effect compares by value, not by array identity.
	const selectedKey = useMemo(
		() => [...selectedUsers].sort().join(","),
		[selectedUsers],
	);

	const unsubscribeRef = useRef<(() => void) | null>(null);

	/** The query, minus paging. Every field the page-0 listener depends on. */
	const baseWindow = useMemo(
		() => ({
			from: window.from,
			to: window.to,
			filter: filterType,
			userId,
			selectedUsers: selectedKey ? selectedKey.split(",") : [],
		}),
		[window.from, window.to, filterType, userId, selectedKey],
	);

	useEffect(() => {
		if (!companyId) {
			setLivePage([]);
			setPagedEvents([]);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		/*
		 * A new query invalidates every page fetched under the old one — their
		 * cursors point into an ordering that no longer applies.
		 */
		setPagedEvents([]);
		setCursor(null);
		setHasMore(false);

		const unsubscribe = subscribeEventsInRange(
			companyId,
			{ ...baseWindow, limit: pageSize },
			(next, nextCursor) => {
				setLivePage(next);
				setHasMore(next.length === pageSize);
				/*
				 * Only page 0 owns the cursor until something is paged past it.
				 * Once it does, the tail belongs to the last fetched page, and
				 * page 0 shifting under a newly created event must not drag it
				 * backwards — merging dedupes, so a small overlap is harmless
				 * where a rewind would re-fetch pages endlessly.
				 */
				setCursor((prev) => (prev === null ? nextCursor : prev));
				setIsLoading(false);
			},
			(e) => {
				// Surfaced rather than swallowed: v1 returned [] on failure, so a
				// missing index was indistinguishable from an empty calendar.
				setError(e);
				setIsLoading(false);
			},
		);

		unsubscribeRef.current = unsubscribe;
		return () => {
			unsubscribe();
			unsubscribeRef.current = null;
		};
	}, [companyId, baseWindow, pageSize]);

	/*
	 * The live first page plus everything paged after it.
	 *
	 * Deduped by id: page 0 is live, so an event created near its boundary can
	 * appear both there and in a page fetched before it existed. Re-sorted
	 * because the pages are only individually ordered.
	 */
	const events = useMemo(() => {
		const byId = new Map<string, Event>();
		for (const event of livePage) byId.set(event.id, event);
		for (const event of pagedEvents) {
			if (!byId.has(event.id)) byId.set(event.id, event);
		}
		return [...byId.values()].sort((a, b) =>
			(a.dateKey ?? "").localeCompare(b.dateKey ?? ""),
		);
	}, [livePage, pagedEvents]);

	/** Fetch the next page. Safe to call on every scroll — it self-guards. */
	const loadMore = useCallback(async () => {
		if (!companyId || !hasMore || !cursor || isLoadingMore) return;

		setIsLoadingMore(true);
		try {
			const page = await getEventPage(companyId, {
				...baseWindow,
				limit: pageSize,
				startAfter: cursor,
			});
			setPagedEvents((prev) => [...prev, ...page.events]);
			if (page.cursor) setCursor(page.cursor);
			setHasMore(page.hasMore);
		} finally {
			setIsLoadingMore(false);
		}
	}, [companyId, hasMore, cursor, isLoadingMore, baseWindow, pageSize]);

	useEffect(() => {
		if (!companyId) return;
		return subscribeEventLabels(companyId, (next: EventLabel[]) => {
			setLabels(
				Object.fromEntries(
					next.map((label) => [label.id, label.color]),
				),
			);
		});
	}, [companyId]);

	/*
	 * How many events there ARE from today on, not how many are loaded.
	 *
	 * An aggregate query, so the answer costs about one read regardless of the
	 * size of the schedule — the counter can be honest without the client
	 * fetching everything it is counting.
	 *
	 * Deliberately anchored on TODAY rather than on the loaded window: paging
	 * further ahead, or revealing earlier weeks, does not change how many
	 * events are coming up, so the number must not move when you scroll.
	 *
	 * Null when the SPECIFIC sub-filters are on. `allSelected`/`exactSelected`
	 * are refined in JS, so the server would answer a LOOSER question than the
	 * one on screen, and a count that overstates is worse than none.
	 */
	const refined =
		filterType === FilterType.SPECIFIC &&
		(showAllSelectedOnly || showExactSelectedOnly);

	const [upcomingCount, setUpcomingCount] = useState<number | null>(null);

	useEffect(() => {
		if (!companyId || refined) {
			setUpcomingCount(null);
			return;
		}

		let cancelled = false;
		countEventsInRange(companyId, {
			from: dayKey(startOfToday(), 0),
			filter: filterType,
			userId,
			selectedUsers: selectedKey ? selectedKey.split(",") : [],
		}).then((total) => {
			if (!cancelled) setUpcomingCount(total);
		});

		return () => {
			cancelled = true;
		};
	}, [companyId, userId, filterType, selectedKey, refined, events.length]);

	/** The one filter Firestore cannot express, over the narrowed result. */
	const visible = useMemo(() => {
		if (filterType !== FilterType.SPECIFIC) return events;
		return refineSelection(
			events,
			selectedKey ? selectedKey.split(",") : [],
			{
				allSelected: showAllSelectedOnly,
				exactSelected: showExactSelectedOnly,
			},
		);
	}, [
		events,
		filterType,
		selectedKey,
		showAllSelectedOnly,
		showExactSelectedOnly,
	]);

	const agendaItems = useMemo<AgendaItems>(() => {
		const grouped: AgendaItems = {};
		for (const event of visible) {
			if (!event.dateKey) continue;
			(grouped[event.dateKey] ??= []).push({
				day: event.dateKey,
				title: event.title,
				startAt: event.startAt ? event.startAt.toDate() : null,
				endAt: event.endAt ? event.endAt.toDate() : null,
				durationSeconds: event.durationSeconds,
				isAllDay: event.isAllDay,
				assigned: event.assignedUserIds ?? [],
				uid: event.id,
				labelId: event.labelId,
			});
		}
		for (const day of Object.keys(grouped)) {
			grouped[day].sort(
				(a, b) =>
					(a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0),
			);
		}
		return grouped;
	}, [visible]);

	/*
	 * Marks come from the SAME windowed set as the agenda.
	 *
	 * v1 computed marks over every event in the company, which is the reason the
	 * whole-collection read felt unavoidable. Dots outside the loaded window
	 * appear as the user scrolls and the window moves.
	 */
	const markedDates = useMemo<MarkedDates>(() => {
		const marks: MarkedDates = {};
		for (const event of visible) {
			if (!event.dateKey) continue;
			marks[event.dateKey] = {
				marked: true,
				dotColor: (event.labelId && labels[event.labelId]) || "grey",
			};
		}
		return marks;
	}, [visible, labels]);

	const loadPastEvents = useCallback(
		() => setPastDays((n) => n + PAST_STEP_DAYS[pastWindow]),
		[pastWindow],
	);

	/** Collapse the window back to where it started, discarding every past step. */
	const clearPastEvents = useCallback(() => setPastDays(0), []);

	return {
		events: visible,
		agendaItems,
		markedDates,
		labels,
		isLoading,
		error,
		window,
		loadPastEvents,
		clearPastEvents,
		hasLoadedPast: pastDays > 0,
		/* Infinite list. */
		loadMore,
		hasMore,
		isLoadingMore,
		/**
		 * Every event from today on in this filter — null while it is being
		 * counted, when the count failed, or when a JS-only sub-filter makes the
		 * server's answer the wrong question.
		 */
		upcomingCount,
	};
}
