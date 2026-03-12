import { useState, useEffect, useCallback } from "react";
import React from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
	confirmEvent,
	declineEvent,
	fetchUnassignedUpcomingEvents,
	fetchUpcomingEventsForUser,
	undeclineEvent,
} from "../services/availabilityService";

type AvailabilityTab = "unconfirmed" | "confirmed" | "declined";

type FormattedEvent = {
	id: string;
	date: string;
	location: string;
	title: string;
	status: string;
	confirmed: boolean;
	rawData: any;
};

/**
 * useAvailabilityEvents
 *
 * Manages fetching, transforming, filtering, and status updates for
 * availability events. Extracts all event-related business logic
 * from AvailabilityPage.
 */
export const useAvailabilityEvents = (companyId: string, userId: string) => {
	const [activeTab, setActiveTab] = useState<AvailabilityTab>("unconfirmed");
	const [events, setEvents] = useState<FormattedEvent[]>([]);
	const [loading, setLoading] = useState(true);

	// Refresh data every time the screen comes into focus
	useFocusEffect(
		React.useCallback(() => {
			fetchEvents();
		}, [userId, companyId]),
	);

	useEffect(() => {
		fetchEvents();
	}, [userId]);

	const fetchEvents = useCallback(async () => {
		setLoading(true);

		try {
			// Get unassigned events from your service
			const fetchedEvents: any =
				await fetchUnassignedUpcomingEvents(companyId);

			// Get assigned events for the current user to check for conflicts
			const assignedEvents: any = await fetchUpcomingEventsForUser(
				companyId,
				userId,
			);

			if (fetchedEvents && fetchedEvents.length > 0) {
				// Create a set of dates where the user already has assigned events
				const assignedEventDates = new Set(
					assignedEvents?.map((event) => {
						return event.date; // Use the date string directly for comparison
					}) || [],
				);

				// Transform the fetched events to match the UI requirements
				const formattedEvents = fetchedEvents.map((event) => {
					// Use the date string directly from Firebase (YYYY-MM-DD format)
					const eventDateString = event.date;

					// Parse the date string correctly to avoid timezone issues
					const [year, month, day] = event.date.split("-");
					const eventDate = new Date(
						parseInt(year),
						parseInt(month) - 1,
						parseInt(day),
					);

					// Format date to a user-friendly string
					const formattedDate = eventDate.toLocaleDateString(
						"en-US",
						{
							weekday: "short",
							month: "short",
							day: "numeric",
							year: "numeric",
						},
					);

					// Set location based on event.locations map (address -> {lat, lng})
					let location = "Location TBD";
					if (event.locations) {
						const locationKeys = Object.keys(event.locations);
						if (locationKeys.length === 1) {
							location = locationKeys[0];
						} else if (locationKeys.length > 1) {
							location = "Multiple locations";
						}
					}

					// Check if user is in workerStatus map
					let status = "available";
					let confirmed = false;

					if (event.workerStatus && event.workerStatus[userId]) {
						const userStatus = event.workerStatus[userId];
						if (userStatus === "confirmed") {
							status = "on_potential_event";
							confirmed = true;
						} else if (userStatus === "declined") {
							status = "on_potential_event";
							confirmed = false;
						}
					}

					// Check if user is already assigned to another event on the same day
					// Only override status if user hasn't responded to this event yet
					if (
						assignedEventDates.has(eventDateString) &&
						status === "available"
					) {
						status = "already_on_event";
					}

					return {
						id: event.id,
						date: formattedDate,
						location: location,
						title: event.title || "Unnamed Event",
						status: status,
						confirmed: confirmed,
						rawData: event,
					};
				});

				setEvents(formattedEvents);
			} else {
				setEvents([]);
			}
		} catch (error) {
			console.error("Error fetching events:", error);
			setEvents([]);
		} finally {
			setLoading(false);
		}
	}, [companyId, userId]);

	const updateEventStatus = useCallback(
		async (eventId: string, confirmed: boolean) => {
			if (confirmed) {
				await confirmEvent(companyId, eventId, userId);
			} else {
				await declineEvent(companyId, eventId, userId);
			}

			setEvents((prevEvents) =>
				prevEvents.map((event) =>
					event.id === eventId
						? {
								...event,
								confirmed,
								status: confirmed
									? "already_on_event"
									: "on_potential_event",
							}
						: event,
				),
			);
		},
		[companyId, userId],
	);

	const handleUndecline = useCallback(
		(eventId: string) => {
			undeclineEvent(companyId, eventId, userId);

			setEvents((prevEvents) =>
				prevEvents.map((event) =>
					event.id === eventId
						? { ...event, status: "available", confirmed: false }
						: event,
				),
			);
		},
		[companyId, userId],
	);

	const getFilteredEvents = useCallback(() => {
		switch (activeTab) {
			case "unconfirmed":
				return events.filter(
					(event) =>
						(event.status === "available" ||
							event.status === "already_on_event") &&
						!event.confirmed,
				);
			case "confirmed":
				return events.filter((event) => event.confirmed === true);
			case "declined":
				return events.filter(
					(event) =>
						event.confirmed === false &&
						event.status === "on_potential_event",
				);
			default:
				return events;
		}
	}, [activeTab, events]);

	return {
		activeTab,
		setActiveTab,
		events,
		loading,
		getFilteredEvents,
		updateEventStatus,
		handleUndecline,
		refetch: fetchEvents,
	};
};
