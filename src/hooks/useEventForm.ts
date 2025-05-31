import { useState, useEffect, useCallback } from "react";
import { Alert } from "react-native";
import moment from "moment";
import {
	addEvent,
	deleteEvent,
	subscribeEvent,
	updateEvent,
} from "../services/eventService";
import { Event } from "../types";
import { useUser } from "../contexts/UserContext";

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
	const [availableWorkers, setAvailableWorkers] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isEditing, setIsEditing] = useState(!!eventId);
	const [editID, setEditID] = useState<string | null>(eventId || null);
	const [editingLabelForAddress, setEditingLabelForAddress] = useState("");
	const [labelText, setLabelText] = useState("");

	// Load user data
	const { user, companyId: currentCompany } = useUser();

	// Load event data if editing
	useEffect(() => {
		if (!isEditing || !currentCompany || !editID) return;

		setIsLoading(true);
		const subscriber = subscribeEvent(currentCompany, editID, (event) => {
			if (event.exists) {
				const data = event.data();
				setTitle(data.title);
				setDate(moment(data.date).toDate());
				setAllDay(!data.startTime);

				if (data.startTime) {
					setStartTime(
						moment(data.startTime, "YYYY-MM-DD HH:mm").toDate(),
					);
				}

				setHasEndTime(!!data.endTime);

				if (data.endTime) {
					setEndTime(
						moment(data.endTime, "YYYY-MM-DD HH:mm").toDate(),
					);
				}

				setLocations(data.locations);
				setAssignedWorkers(data.assignedWorkers || []);
				setNotes(data.notes || "");

				setOriginalValues({
					title: data.title,
					date: moment(data.date).toDate(),
					allDay: !data.startTime,
					startTime: data.startTime
						? moment(data.startTime, "YYYY-MM-DD HH:mm").toDate()
						: new Date(),
					hasEndTime: !!data.endTime,
					endTime: data.endTime
						? moment(data.endTime, "YYYY-MM-DD HH:mm").toDate()
						: new Date(),
					locations: data.locations || {},
					assignedWorkers: data.assignedWorkers || [],
					notes: data.notes || "",
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
	const handleSubmitData = useCallback(async () => {
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

			const eventData: Event = {
				id: editID || "",
				title,
				date: moment(date).format("YYYY-MM-DD"),
				startTime: !allDay
					? moment(date)
							.hours(startTime.getHours())
							.minutes(startTime.getMinutes())
							.toISOString(true)
					: null,
				endTime: hasEndTime ? moment(endTime).toISOString(true) : null,
				locations: validatedLocations,
				duration: calculateDuration(),
				notes,
				assignedWorkers,
				packages: [],
			};

			let eventId;

			if (isEditing && editID) {
				await updateEvent(currentCompany, editID, eventData);
				eventId = editID;
			} else {
				eventId = await addEvent(currentCompany, eventData);
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
				default:
					Alert.alert("Error creating event, please try again");
			}
			return null;
		} finally {
			setIsLoading(false);
		}
	}, [
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
	]);

	// Handle event deletion
	const handleDelete = useCallback(async () => {
		if (!isEditing || !editID) return;

		try {
			setIsLoading(true);
			await deleteEvent(editID, currentCompany);
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
		availableWorkers,
		setAvailableWorkers,
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
