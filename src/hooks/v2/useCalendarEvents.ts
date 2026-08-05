import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkedDates } from "react-native-calendars/src/types";
import {
	refineSelection,
	subscribeEventsInRange,
} from "../../services/v2/eventService";
import { subscribeEventLabels } from "../../services/v2/libraryService";
import { Event, EventLabel } from "../../types/v2";
import { FilterType } from "../../types/enums/FilterType";

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

/** Months of history and future loaded around the focused month. */
const MONTHS_BEFORE = 1;
const MONTHS_AFTER = 2;
/** How far back "load past events" reaches each time it is pressed. */
const PAST_EXPANSION_MONTHS = 12;

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

export type UseCalendarEventsOptions = {
	companyId: string;
	userId: string;
	filterType: FilterType;
	selectedUsers?: string[];
	showAllSelectedOnly?: boolean;
	showExactSelectedOnly?: boolean;
	/** Month the calendar is showing; the window is built around it. */
	focusedMonth?: Date;
};

export function useCalendarEvents({
	companyId,
	userId,
	filterType,
	selectedUsers = [],
	showAllSelectedOnly = false,
	showExactSelectedOnly = false,
	focusedMonth,
}: UseCalendarEventsOptions) {
	const [events, setEvents] = useState<Event[]>([]);
	const [labels, setLabels] = useState<Record<string, string>>({});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const [pastMonths, setPastMonths] = useState(0);

	// A stable month anchor: a raw Date in the dependency array would be a new
	// object every render and resubscribe endlessly.
	const anchor = useMemo(() => {
		const base = focusedMonth ?? new Date();
		return new Date(base.getFullYear(), base.getMonth(), 1);
	}, [focusedMonth?.getFullYear(), focusedMonth?.getMonth()]);

	const window = useMemo(
		() => ({
			from: monthKey(anchor, -(MONTHS_BEFORE + pastMonths), 1),
			to: monthKey(anchor, MONTHS_AFTER + 1, 0),
		}),
		[anchor, pastMonths],
	);

	// Serialized so the effect compares by value, not by array identity.
	const selectedKey = useMemo(
		() => [...selectedUsers].sort().join(","),
		[selectedUsers],
	);

	const unsubscribeRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		if (!companyId) {
			setEvents([]);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		const unsubscribe = subscribeEventsInRange(
			companyId,
			{
				from: window.from,
				to: window.to,
				filter: filterType,
				userId,
				selectedUsers: selectedKey ? selectedKey.split(",") : [],
			},
			(next) => {
				setEvents(next);
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
	}, [companyId, userId, filterType, selectedKey, window.from, window.to]);

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
		() => setPastMonths((n) => n + PAST_EXPANSION_MONTHS),
		[],
	);

	return {
		events: visible,
		agendaItems,
		markedDates,
		labels,
		isLoading,
		error,
		window,
		loadPastEvents,
		hasLoadedPast: pastMonths > 0,
	};
}
