import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useUser } from "../contexts/UserContext";
import { useCompany } from "../contexts/CompanyContext";
import { useCompanyMembers } from "./useCompanyMembers";
import { useGroups } from "./useGroups";
import {
	getAvailabilityEvents,
	getEventResponses,
	getEventsInRange,
	setEventResponse,
	subscribeMyResponses,
} from "../services/eventService";
import { FilterType } from "../types";

export type AvailabilityTab = "unconfirmed" | "confirmed" | "declined";

/**
 * One event as the list renders it.
 *
 * `rawData` carries the underlying document for the few places that need a
 * field the card does not display (the date key, when recording a response).
 */
export type AvailabilityEvent = {
	id: string;
	date: string;
	location: string;
	title: string;
	status: "available" | "already_on_event" | "on_potential_event";
	confirmed: boolean;
	groupNames: string[];
	personNames: string[];
	rawData: any;
};

export type WorkerBuckets = {
	confirmed: any[];
	declined: any[];
	unconfirmed: any[];
};

const todayKey = () => new Date().toISOString().slice(0, 10);

/** Parsed from the YYYY-MM-DD key rather than `new Date(string)`, which is UTC. */
const formatEventDate = (dateKey: string) => {
	const [year, month, day] = dateKey.split("-");
	return new Date(
		parseInt(year),
		parseInt(month) - 1,
		parseInt(day),
	).toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
};

/** An event carries a map of address -> coords; the list shows one line. */
const describeLocation = (locations?: Record<string, unknown>) => {
	const addresses = Object.keys(locations ?? {});
	if (addresses.length === 1) return addresses[0];
	if (addresses.length > 1) return "Multiple locations";
	return "Location TBD";
};

/**
 * Everything the availability screen needs: the worker's open jobs and
 * invitations, their responses, and the admin roster for one event.
 *
 * The screen renders; this owns the data.
 */
export const useAvailability = () => {
	const { userId, companyId, isAdmin, membership } = useUser();
	const { preferences, updatePreferences } = useCompany();
	const { members, namesFor: personNamesFor } = useCompanyMembers(
		companyId ?? "",
	);
	const { namesFor: groupNamesFor } = useGroups(companyId ?? "");

	const [activeTab, setActiveTab] = useState<AvailabilityTab>("unconfirmed");
	const [events, setEvents] = useState<AvailabilityEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [myResponses, setMyResponses] = useState<Record<string, string>>({});

	/*
	 * Which jobs this worker is allowed to see.
	 *
	 * "open" is the default and what every migrated membership carries: all
	 * unassigned events not published to a specific group. A "restricted"
	 * worker — a 1099 contractor — sees only the jobs they were invited to.
	 */
	const visibility = membership?.visibility ?? "open";

	/*
	 * The response ids double as the invitation list, and the focus handler
	 * fetches from a callback whose deps cannot include `myResponses` without
	 * refetching on every snapshot — so it would close over an empty map and
	 * show a restricted worker nothing. A ref keeps the fetch reading the
	 * current set whenever it runs.
	 */
	const myResponsesRef = useRef<Record<string, string>>({});

	const fetchEvents = useCallback(async () => {
		if (!companyId || !userId) return;
		setLoading(true);

		try {
			const today = todayKey();

			/*
			 * Open jobs plus this worker's invitations, or invitations alone if
			 * they are restricted. The invitation ids come from their own
			 * eventResponses, which the security rules already scope to them —
			 * a worker never invited to a targeted job has no document for it,
			 * so it cannot appear here.
			 */
			const fetched = await getAvailabilityEvents(
				companyId,
				today,
				visibility,
				Object.keys(myResponsesRef.current),
				Boolean(isAdmin),
			);

			if (!fetched?.length) {
				setEvents([]);
				return;
			}

			// Days the worker is already committed to, for the conflict badge.
			const assigned = await getEventsInRange(companyId, {
				from: today,
				to: "2999-12-31",
				filter: FilterType.MY,
				userId,
			});
			const assignedDates = new Set(
				assigned?.map((event) => event.dateKey) ?? [],
			);

			setEvents(
				fetched.map((event) => {
					// One lookup in the responses map.
					const response = myResponses[event.id];
					const responded =
						response === "confirmed" || response === "declined";

					let status: AvailabilityEvent["status"] = "available";
					if (responded) {
						status = "on_potential_event";
					} else if (assignedDates.has(event.dateKey)) {
						// Only when unanswered, so it still shows as unconfirmed.
						status = "already_on_event";
					}

					return {
						id: event.id,
						date: formatEventDate(event.dateKey),
						location: describeLocation(event.locations),
						title: event.title || "Unnamed Event",
						status,
						confirmed: response === "confirmed",
						groupNames: groupNamesFor(event.audienceGroupIds ?? []),
						personNames: personNamesFor(
							event.audienceUserIds ?? [],
						),
						rawData: event,
					};
				}),
			);
		} catch (error) {
			console.error("Error fetching events:", error);
			setEvents([]);
		} finally {
			setLoading(false);
		}
	}, [
		companyId,
		userId,
		visibility,
		isAdmin,
		myResponses,
		groupNamesFor,
		personNamesFor,
	]);

	useEffect(() => {
		if (!companyId || !userId) return;
		return subscribeMyResponses(companyId, userId, todayKey(), (next) => {
			myResponsesRef.current = next;
			setMyResponses(next);
		});
	}, [companyId, userId]);

	/*
	 * `visibility` is a dependency because the membership subscription is live:
	 * a manager restricting a worker takes effect on their device immediately,
	 * without a relaunch.
	 */
	useEffect(() => {
		fetchEvents();
	}, [fetchEvents]);

	useFocusEffect(
		useCallback(() => {
			fetchEvents();
		}, [fetchEvents]),
	);

	/**
	 * Records this worker's own answer, and reflects it locally at once.
	 *
	 * Takes the whole event rather than an id SO THAT dateKey cannot be
	 * omitted. It used to default to "", and `subscribeMyResponses` filters on
	 * `dateKey >= today` — an empty string sorts before every real date, so a
	 * confirmation was written but never came back from the subscription. The
	 * optimistic update below made it look like it had stuck until the next
	 * refresh dropped it back to unanswered.
	 */
	const respondToEvent = useCallback(
		async (
			event: AvailabilityEvent,
			status: "confirmed" | "declined" | "pending",
		) => {
			const dateKey = event.rawData?.dateKey ?? "";
			if (!dateKey) {
				console.error(
					`Event ${event.id} has no dateKey; response would be invisible to the responses query`,
				);
				return;
			}

			await setEventResponse(
				companyId,
				event.id,
				userId,
				status,
				dateKey,
			);

			setEvents((prev) =>
				prev.map((current) =>
					current.id === event.id
						? {
								...current,
								confirmed: status === "confirmed",
								status:
									status === "pending"
										? "available"
										: status === "confirmed"
											? "already_on_event"
											: "on_potential_event",
							}
						: current,
				),
			);
		},
		[companyId, userId],
	);

	const filteredEvents = (() => {
		switch (activeTab) {
			case "unconfirmed":
				// Unanswered, whether or not the day already has a conflict.
				return events.filter(
					(event) =>
						!event.confirmed &&
						event.status !== "on_potential_event",
				);
			case "confirmed":
				return events.filter((event) => event.confirmed);
			case "declined":
				return events.filter(
					(event) =>
						!event.confirmed &&
						event.status === "on_potential_event",
				);
			default:
				return events;
		}
	})();

	/* ------------------------------------------------ reminder preferences */

	const reminder = preferences?.availabilityReminder;

	const saveReminderSettings = useCallback(
		async (next: { enabled: boolean; hours: string; minutes: string }) => {
			try {
				await updatePreferences({
					availabilityReminder: {
						enabled: next.enabled,
						hours: parseInt(next.hours) || 24,
						minutes: parseInt(next.minutes) || 0,
					},
				});
				Alert.alert(
					"Success",
					"Reminder settings updated successfully!",
				);
				return true;
			} catch (error) {
				console.error("Error saving reminder preferences:", error);
				Alert.alert("Error", "Failed to save reminder settings");
				return false;
			}
		},
		[updatePreferences],
	);

	/* -------------------------------------------------- admin worker roster */

	const [workerBuckets, setWorkerBuckets] = useState<WorkerBuckets>({
		confirmed: [],
		declined: [],
		unconfirmed: [],
	});
	const [loadingWorkers, setLoadingWorkers] = useState(false);

	/**
	 * Buckets every member by their answer for one event.
	 *
	 * Members come from the membership query already running, and their
	 * responses from one eventResponses query.
	 */
	const loadWorkerBuckets = useCallback(
		async (eventId: string) => {
			setLoadingWorkers(true);
			try {
				const responses = await getEventResponses(companyId, eventId);
				const buckets: WorkerBuckets = {
					confirmed: [],
					declined: [],
					unconfirmed: [],
				};

				members.forEach((member) => {
					const status = responses[member.userId];
					const withStatus = {
						...member,
						id: member.userId,
						status: status ?? "pending",
					};

					if (status === "confirmed")
						buckets.confirmed.push(withStatus);
					else if (status === "declined")
						buckets.declined.push(withStatus);
					else buckets.unconfirmed.push(withStatus);
				});

				setWorkerBuckets(buckets);
			} catch (error) {
				console.error("Error fetching worker details:", error);
			} finally {
				setLoadingWorkers(false);
			}
		},
		[companyId, members],
	);

	/** A manager answering on a worker's behalf. */
	const setWorkerResponse = useCallback(
		async (
			event: AvailabilityEvent,
			targetUserId: string,
			status: "confirmed" | "declined",
		) => {
			await setEventResponse(
				companyId,
				event.id,
				targetUserId,
				status,
				event.rawData?.dateKey ?? "",
			);

			await loadWorkerBuckets(event.id);
			await fetchEvents();
		},
		[companyId, loadWorkerBuckets, fetchEvents],
	);

	return {
		isAdmin,
		activeTab,
		setActiveTab,
		events,
		filteredEvents,
		loading,
		refresh: fetchEvents,
		respondToEvent,

		reminder,
		saveReminderSettings,

		workerBuckets,
		loadingWorkers,
		loadWorkerBuckets,
		setWorkerResponse,
	};
};
