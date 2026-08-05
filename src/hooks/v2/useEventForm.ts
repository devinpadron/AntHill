import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import moment from "moment";
import {
	createEvent,
	EventWriteInput,
	deleteEvent,
	subscribeEvent,
	syncEventAudience,
	updateEvent,
} from "../../services/v2/eventService";

import { useUser } from "../../contexts/v2/UserContext";
import { useCompany } from "../../contexts/v2/CompanyContext";

export type Location = {
	[address: string]: {
		latitude: number;
		longitude: number;
		label?: string;
	};
};

export const useEventForm = (navigation, eventId?: string) => {
	// Form state
	const [title, setTitle] = useState("");
	const [date, setDate] = useState(new Date());
	const [allDay, setAllDay] = useState(false);
	const [startTime, setStartTime] = useState(new Date());
	const [hasEndTime, setHasEndTime] = useState(false);
	const [endTime, setEndTime] = useState(new Date());
	const [locations, setLocations] = useState<Location | null>(null);
	const [assignedWorkers, setAssignedWorkers] = useState<string[]>([]);
	/*
	 * Which groups this event was published to.
	 *
	 * Seeded from the loaded event, NOT left empty. An unseeded picker would
	 * submit [] on any edit, flipping the event back to open and withdrawing
	 * every invitation nobody had answered yet.
	 */
	const [audienceGroupIds, setAudienceGroupIds] = useState<string[]>([]);
	const [notes, setNotes] = useState("");
	const [originalValues, setOriginalValues] = useState({
		title: "",
		date: new Date(),
		allDay: false,
		startTime: new Date(),
		hasEndTime: false,
		endTime: new Date(),
		locations: {},
		assignedWorkers: [],
		notes: "",
	});

	// UI state
	const [openSelect, setOpenSelect] = useState(false);
	const [openDate, setOpenDate] = useState(false);
	const [openStartTime, setOpenStartTime] = useState(false);
	const [openEndTime, setOpenEndTime] = useState(false);

	const [isLoading, setIsLoading] = useState(false);
	const [isEditing, setIsEditing] = useState(!!eventId);
	const [editID, setEditID] = useState<string | null>(eventId || null);
	const [editingLabelForAddress, setEditingLabelForAddress] = useState("");
	const [labelText, setLabelText] = useState("");

	// Load user data
	const { user, userId, companyId: currentCompany } = useUser();
	const { timeZone } = useCompany();

	// Load event data if editing
	useEffect(() => {
		if (!isEditing || !currentCompany || !editID) return;

		setIsLoading(true);
		const subscriber = subscribeEvent(editID, (data) => {
			if (data) {
				setTitle(data.title);
				setDate(moment(data.dateKey, "YYYY-MM-DD").toDate());
				setAllDay(data.isAllDay);

				/*
				 * startAt/endAt are Timestamps. v1 stored offset-ISO strings and
				 * re-parsed them here with the format "YYYY-MM-DD HH:mm", which
				 * moment accepted leniently and resolved to the WRONG TIME —
				 * this is why edit-mode times drifted.
				 */
				const start = data.startAt ? data.startAt.toDate() : null;
				const end = data.endAt ? data.endAt.toDate() : null;

				if (start) setStartTime(start);
				setHasEndTime(Boolean(end));
				if (end) setEndTime(end);

				setLocations(data.locations);
				setAssignedWorkers(data.assignedUserIds || []);
				setAudienceGroupIds(data.audienceGroupIds || []);
				setNotes(data.adminNotes || "");

				setOriginalValues({
					title: data.title,
					date: moment(data.dateKey, "YYYY-MM-DD").toDate(),
					allDay: data.isAllDay,
					startTime: start ?? new Date(),
					hasEndTime: Boolean(end),
					endTime: end ?? new Date(),
					locations: data.locations || {},
					assignedWorkers: data.assignedUserIds || [],
					notes: data.adminNotes || "",
				});
			}
			setIsLoading(false);
		});

		return () => subscriber();
	}, [currentCompany, editID, isEditing]);

	// Calculate event duration
	const calculateDuration = useCallback(() => {
		if (allDay || !hasEndTime) return null;
		const realStartTime = moment(startTime).format(
			moment(date).format("YYYY-MM-DD") + " HH:mm",
		);
		const hours = moment(endTime).diff(realStartTime, "minutes") / 60;
		return hours.toFixed(2).toString();
	}, [allDay, hasEndTime, startTime, endTime]);

	// Form validation
	const validateFields = useCallback(() => {
		if (!title.trim()) {
			Alert.alert("Title is required.");
			return false;
		}

		if (!allDay && hasEndTime && endTime <= startTime) {
			Alert.alert("End time must be after start time.");
			return false;
		}

		return true;
	}, [title, allDay, hasEndTime, endTime, startTime]);

	// Handle location update
	const updateLocation = useCallback((details: any) => {
		const address = details.formatted_address;
		const coords = details.geometry.location;

		setLocations((prev) => ({
			...prev,
			[address]: {
				latitude: coords.lat,
				longitude: coords.lng,
			},
		}));

		return address;
	}, []);

	// Delete a location
	const deleteLocation = useCallback(
		(address: string) => {
			setLocations((prev) => {
				if (!prev) return prev;

				const newLocations = { ...prev };
				delete newLocations[address];
				return newLocations;
			});

			if (editingLabelForAddress === address) {
				setEditingLabelForAddress("");
			}
		},
		[editingLabelForAddress],
	);

	// Set location label
	const setLocationLabel = useCallback((address: string, label: string) => {
		setLocations((prev) => {
			if (!prev || !prev[address]) return prev;

			return {
				...prev,
				[address]: {
					...prev[address],
					label,
				},
			};
		});
	}, []);

	// Toggle date picker
	const toggleDatePicker = useCallback((picker: string) => {
		switch (picker) {
			case "date":
				setOpenDate((prev) => !prev);
				setOpenSelect(false);
				setOpenStartTime(false);
				setOpenEndTime(false);
				break;
			case "startTime":
				setOpenStartTime((prev) => !prev);
				setOpenDate(false);
				setOpenSelect(false);
				setOpenEndTime(false);
				break;
			case "endTime":
				setOpenEndTime((prev) => !prev);
				setOpenDate(false);
				setOpenStartTime(false);
				setOpenSelect(false);
				break;
			case "select":
				setOpenSelect((prev) => !prev);
				setOpenDate(false);
				setOpenStartTime(false);
				setOpenEndTime(false);
				break;
		}
	}, []);

	// Toggle all day event
	const toggleAllDay = useCallback(() => {
		setAllDay((prev) => {
			const newValue = !prev;

			if (newValue) {
				setStartTime(null);
				setHasEndTime(false);
				setEndTime(null);
			} else {
				setStartTime(new Date());
			}

			return newValue;
		});
	}, []);

	// Toggle end time
	const toggleEndTime = useCallback(() => {
		setHasEndTime((prev) => {
			const newValue = !prev;

			if (newValue) {
				// Create a new date that keeps the user's selected date but sets the time
				const newEndTime = new Date(date);

				// If there's a start time, set end time to 1 hour after start time
				if (!allDay && startTime) {
					newEndTime.setHours(startTime.getHours() + 1);
					newEndTime.setMinutes(startTime.getMinutes());
				} else {
					// Default to current time if no start time
					const now = new Date();
					newEndTime.setHours(now.getHours());
					newEndTime.setMinutes(now.getMinutes());
				}

				setEndTime(newEndTime);
				setOpenEndTime(true);
			} else {
				setEndTime(null);
			}

			return newValue;
		});
	}, [date, startTime, allDay]);

	// Handle event submission
	/*
	 * `extra` carries packages and label. v1's EventSubmit called this, then
	 * issued a SECOND updateEvent for those two fields — so creating an event
	 * was three writes (add, update id, update packages/label). Passing them in
	 * makes it one.
	 */
	const handleSubmitData = useCallback(
		async (extra?: {
			packageIds?: string[];
			labelId?: string | null;
			audienceGroupIds?: string[];
		}) => {
			if (!validateFields()) return;

			try {
				setIsLoading(true);

				const validatedLocations = locations
					? Object.entries(locations).reduce(
							(acc: Location, [key, value]) => {
								if (value.latitude && value.longitude) {
									acc[key] = value;
								}
								return acc;
							},
							{},
						)
					: null;

				const dateKey = moment(date).format("YYYY-MM-DD");

				/*
				 * Instants, not strings. v1 wrote offset-ISO for start/end, a
				 * "YYYY-MM-DD" string for the date, and the duration as a STRING of
				 * hours — three representations for what is really one moment plus
				 * a length.
				 */
				const startAt = allDay
					? null
					: moment(date)
							.hours(startTime.getHours())
							.minutes(startTime.getMinutes())
							.seconds(0)
							.toDate();

				const endAt =
					!allDay && hasEndTime
						? moment(date)
								.hours(endTime.getHours())
								.minutes(endTime.getMinutes())
								.seconds(0)
								.toDate()
						: null;

				const durationSeconds =
					startAt && endAt
						? Math.max(
								0,
								Math.round(
									(endAt.getTime() - startAt.getTime()) /
										1000,
								),
							)
						: null;

				const eventData: EventWriteInput = {
					title,
					dateKey,
					isAllDay: allDay,
					startAt,
					endAt,
					durationSeconds,
					adminNotes: notes,
					locations: validatedLocations ?? {},
					assignedUserIds: assignedWorkers,
					...(extra?.packageIds
						? { packageIds: extra.packageIds }
						: {}),
					...(extra?.labelId !== undefined
						? { labelId: extra.labelId }
						: {}),
					...(extra?.audienceGroupIds
						? { audienceGroupIds: extra.audienceGroupIds }
						: {}),
				};

				let eventId;

				if (isEditing && editID) {
					// A patch, not a whole-document write.
					await updateEvent(editID, eventData, userId);
					eventId = editID;
					/*
					 * Re-publishing an edited event. createEvent does this
					 * itself, but an edit has to be reconciled: workers added
					 * to a group get an invitation, and invitations nobody
					 * answered are withdrawn if their group was removed.
					 */
					if (extra?.audienceGroupIds) {
						await syncEventAudience(
							currentCompany,
							editID,
							dateKey,
							extra.audienceGroupIds,
						);
					}
				} else {
					// ONE write. v1 did add() then update({id}).
					eventId = await createEvent(
						currentCompany,
						eventData,
						userId,
					);
				}
				return eventId;
			} catch (error) {
				console.error("Error submitting event:", error);

				switch (error.code) {
					case "event/invalid-workers":
						Alert.alert(
							"One or more selected workers are not available!",
						);
						break;
					/*
					 * The event IS saved — only the invitations failed. Saying
					 * "try again" here would produce a duplicate event, and
					 * saying nothing would leave a job nobody was asked about.
					 */
					case "event/audience-not-notified":
						Alert.alert(
							"Event saved",
							"The event was created, but the groups you picked have not been notified yet. Open it and save again to send the invitations.",
						);
						return error.eventId ?? null;
					default:
						Alert.alert("Error creating event, please try again");
				}
				return null;
			} finally {
				setIsLoading(false);
			}
		},
		[
			title,
			date,
			allDay,
			startTime,
			hasEndTime,
			endTime,
			locations,
			notes,
			assignedWorkers,
			isEditing,
			editID,
			calculateDuration,
			validateFields,
			currentCompany,
			navigation,
			userId,
		],
	);

	// Handle event deletion
	const handleDelete = useCallback(async () => {
		if (!isEditing || !editID) return;

		try {
			setIsLoading(true);
			await deleteEvent(currentCompany, editID);
			navigation.pop(2);
		} catch (error) {
			Alert.alert("Error deleting event, please try again");
			console.error(error);
		} finally {
			setIsLoading(false);
		}
	}, [currentCompany, editID, isEditing, navigation]);

	const hasFormChanged = useCallback(() => {
		// If we're not editing, any content is a change
		if (!isEditing) {
			return title.trim() !== "";
		}

		// For edit mode, compare with original values
		if (
			title !== originalValues.title ||
			!moment(date).isSame(moment(originalValues.date), "day") ||
			allDay !== originalValues.allDay ||
			(!allDay &&
				!moment(startTime).isSame(
					moment(originalValues.startTime),
					"minute",
				)) ||
			hasEndTime !== originalValues.hasEndTime ||
			(hasEndTime &&
				!moment(endTime).isSame(
					moment(originalValues.endTime),
					"minute",
				)) ||
			notes !== originalValues.notes
		) {
			return true;
		}

		// Check for location changes
		const originalLocationKeys = Object.keys(
			originalValues.locations || {},
		);
		const currentLocationKeys = Object.keys(locations || {});

		if (originalLocationKeys.length !== currentLocationKeys.length) {
			return true;
		}

		// Check if any locations were modified
		for (const address of currentLocationKeys) {
			if (!originalValues.locations[address]) {
				return true; // New location added
			}

			if (
				originalValues.locations[address].label !==
				locations[address].label
			) {
				return true; // Label changed
			}
		}

		// Check for worker assignment changes
		if (assignedWorkers.length !== originalValues.assignedWorkers.length) {
			return true;
		}

		const sortedOriginalWorkers = [
			...originalValues.assignedWorkers,
		].sort();
		const sortedCurrentWorkers = [...assignedWorkers].sort();

		for (let i = 0; i < sortedCurrentWorkers.length; i++) {
			if (sortedCurrentWorkers[i] !== sortedOriginalWorkers[i]) {
				return true; // Worker assignments changed
			}
		}

		return false;
	}, [
		isEditing,
		title,
		date,
		allDay,
		startTime,
		hasEndTime,
		endTime,
		notes,
		locations,
		assignedWorkers,
		originalValues,
	]);

	return {
		// Form state
		title,
		setTitle,
		date,
		setDate,
		allDay,
		startTime,
		setStartTime,
		hasEndTime,
		endTime,
		setEndTime,
		locations,
		assignedWorkers,
		setAssignedWorkers,
		audienceGroupIds,
		setAudienceGroupIds,
		notes,
		setNotes,
		originalValues,

		// UI state
		openSelect,
		openDate,
		openStartTime,
		openEndTime,
		isLoading,
		isEditing,
		editingLabelForAddress,
		setEditingLabelForAddress,
		labelText,
		setLabelText,

		// Methods
		updateLocation,
		deleteLocation,
		setLocationLabel,
		toggleDatePicker,
		toggleAllDay,
		toggleEndTime,
		handleSubmitData,
		handleDelete,
		hasFormChanged,
	};
};
