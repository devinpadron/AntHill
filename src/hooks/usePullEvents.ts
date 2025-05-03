import moment from "moment";
import { getAgendaItems, getMarkedDates } from "../services/agendaItemService";
import { subscribeAllEvents } from "../services/eventService";
import { FilterType } from "../types/enums/FilterType";
import { useEffect, useState, useCallback } from "react";

export const usePullEvents = (
	companyId: string,
	userId: string,
	filterType: FilterType,
	selectedUsers: string[],
	showAllSelectedOnly: boolean,
	showExactSelectedOnly: boolean,
	date?: string | null,
) => {
	const [includePastEvents, setIncludePastEvents] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);
	const [agendaItems, setAgendaItems] = useState({});
	const [markedDates, setMarkedDates] = useState({});
	const [rawEvents, setRawEvents] = useState([]);
	const [isLoading, setIsLoading] = useState(true);

	// Filter function that processes data based on FilterType
	const filterEventsByType = useCallback(
		(events: any[]) => {
			if (!events || events.length === 0) return [];

			console.log(
				`Filtering ${events.length} events by type: ${filterType}`,
			);

			switch (filterType) {
				case FilterType.ALL:
					// Return all events
					return events;

				case FilterType.MY:
					// Only events assigned to current user
					return events.filter((event) => {
						const workers = event.assignedWorkers || [];
						return workers.includes(userId);
					});

				case FilterType.UNASSIGNED:
					// Only events that are unassigned
					return events.filter((event) => {
						const workers = event.assignedWorkers || [];
						return workers.length === 0;
					});

				case FilterType.SPECIFIC:
					if (!selectedUsers || selectedUsers.length === 0) {
						return [];
					}

					return events.filter((event) => {
						const workers = event.assignedWorkers || [];

						if (showExactSelectedOnly) {
							// Events must have exactly these users (same length and all match)
							return (
								workers.length === selectedUsers.length &&
								selectedUsers.every((uid) =>
									workers.includes(uid),
								)
							);
						} else if (showAllSelectedOnly) {
							// All selected users must be in the event
							return selectedUsers.every((uid) =>
								workers.includes(uid),
							);
						} else {
							// At least one selected user must be in the event
							return selectedUsers.some((uid) =>
								workers.includes(uid),
							);
						}
					});

				default:
					console.warn("Unknown filter type:", filterType);
					return events;
			}
		},
		[
			filterType,
			userId,
			selectedUsers,
			showAllSelectedOnly,
			showExactSelectedOnly,
		],
	);

	const filterEventsByDate = useCallback(
		(events: any[]) => {
			if (!events || events.length === 0) return events;

			if (date) {
				// When a specific date is requested, filter for that date only
				return events.filter((event) => event.date === date);
			} else {
				// When no date is provided, show today and future events
				// Or include past events if includePastEvents is true
				const todayString = moment().format("YYYY-MM-DD");

				if (includePastEvents && date === null) {
					// Show all events when past events are included
					return events;
				} else {
					// Only today and future events
					return events.filter((event) => {
						if (!event.date) return false;
						return event.date >= todayString;
					});
				}
			}
		},
		[date, includePastEvents],
	);

	useEffect(() => {
		const handleCalendarFill = (snapshot: { docs: any }) => {
			if (!snapshot || !snapshot.docs) {
				console.log("No events found or invalid snapshot");
				setAgendaItems({});
				setMarkedDates({});
				setRawEvents([]);
				return;
			}

			// Convert snapshot docs to array of event objects
			const allEvents = snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					id: doc.id,
					...data,
				};
			});

			setRawEvents(allEvents);

			// Filter events based on type and date
			const filteredEvents = filterEventsByDate(
				filterEventsByType(allEvents),
			);

			// Create agenda items from filtered events
			const items = getAgendaItems(
				filteredEvents.map((event) => ({
					data: () => event,
				})),
			);
			// For markers, use all events filtered by type (not by date)
			const markedEvents = filterEventsByType(allEvents);
			const marks = getMarkedDates(
				markedEvents.map((event) => ({
					data: () => event,
				})),
			);

			setAgendaItems(items);
			setMarkedDates(marks);
			setIsLoading(false);
			console.log(
				`Processed ${allEvents.length} events, filtered to ${filteredEvents.length} items`,
			);
		};

		const unsubscribe = subscribeAllEvents(companyId, handleCalendarFill);
		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [
		filterType,
		companyId,
		userId,
		selectedUsers,
		showAllSelectedOnly,
		showExactSelectedOnly,
		filterEventsByType,
		filterEventsByDate,
	]);

	return {
		agendaItems,
		markedDates,
		refreshKey,
		setRefreshKey,
		includePastEvents,
		togglePastEvents: () => setIncludePastEvents((prev) => !prev),
		loadPastEvents: () => setIncludePastEvents(true),
		isLoading,
	};
};
