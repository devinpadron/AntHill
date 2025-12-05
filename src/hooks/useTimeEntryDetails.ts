import { useState, useEffect } from "react";
import { Alert } from "react-native";
import {
	getTimeEntry,
	getTimeEntryAttachments,
} from "../services/timeEntryService";
import { getUser } from "../services/userService";
import { calculateFieldTotals } from "../utils/timeUtils";
import { TimeEntry, User } from "../types";

interface UseTimeEntryDetailsParams {
	entryIds: string[];
	companyId: string;
	passedUserId?: string;
}

interface UseTimeEntryDetailsReturn {
	timeEntries: TimeEntry[];
	employeeUser: User | null;
	connectedEvents: Record<string, any[]>;
	attachmentMap: Record<string, any[]>;
	fieldTotals: Record<string, any>;
	totalDurationSeconds: number;
	totalDurationDecimal: number;
	isLoading: boolean;
	refetch: () => Promise<void>;
}

/**
 * useTimeEntryDetails - Manages time entry data loading and calculations
 *
 * Handles:
 * - Fetching time entries by IDs
 * - Loading attachments for each entry
 * - Calculating duration totals and field totals
 * - Fetching employee user information
 * - Organizing connected events
 */
export const useTimeEntryDetails = ({
	entryIds,
	companyId,
	passedUserId,
}: UseTimeEntryDetailsParams): UseTimeEntryDetailsReturn => {
	const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
	const [employeeUser, setEmployeeUser] = useState<User | null>(null);
	const [connectedEvents, setConnectedEvents] = useState<
		Record<string, any[]>
	>({});
	const [attachmentMap, setAttachmentsMap] = useState<Record<string, any[]>>(
		{},
	);
	const [fieldTotals, setFieldTotals] = useState<Record<string, any>>({});
	const [totalDurationSeconds, setTotalDurationSeconds] = useState(0);
	const [totalDurationDecimal, setTotalDurationDecimal] = useState(0);
	const [isLoading, setIsLoading] = useState(true);

	const loadTimeEntries = async () => {
		try {
			setIsLoading(true);

			// Fetch entries and filter out nulls
			const entries = await Promise.all(
				entryIds.map((id) => getTimeEntry(companyId, id)),
			);
			const validEntries = entries.filter(
				(entry): entry is TimeEntry => entry !== null,
			);
			setTimeEntries(validEntries);

			// Fetch attachments
			const attachments: Record<string, any[]> = {};
			await Promise.all(
				validEntries.map(async (entry) => {
					try {
						const entryAttachments = await getTimeEntryAttachments(
							companyId,
							entry.id,
						);
						attachments[entry.id] = entryAttachments;
					} catch (error) {
						console.error(
							`Error fetching attachments for entry ${entry.id}:`,
							error,
						);
						attachments[entry.id] = [];
					}
				}),
			);
			setAttachmentsMap(attachments);

			// Calculate totals
			const totalSeconds = validEntries.reduce(
				(sum, entry) => sum + (entry.duration || 0),
				0,
			);
			setTotalDurationSeconds(totalSeconds);
			setTotalDurationDecimal(+(totalSeconds / 3600).toFixed(2));

			// Get employee info
			const userId = validEntries[0]?.userId || passedUserId;
			if (userId) {
				const user = await getUser(userId);
				setEmployeeUser(user);
			}

			// Calculate field totals
			const totals = calculateFieldTotals(validEntries);
			setFieldTotals(totals);

			// Organize connected events
			const entryConnectionMap: Record<string, any[]> = {};
			validEntries.forEach((entry) => {
				if (entry.connectedEvents && entry.connectedEvents.length > 0) {
					entryConnectionMap[entry.id] = entry.connectedEvents.map(
						(connection: any) => ({
							...connection,
							title: connection.eventTitle || "Connected Event",
							formResponses: connection.formResponses || {},
						}),
					);
				} else {
					entryConnectionMap[entry.id] = [];
				}
			});
			setConnectedEvents(entryConnectionMap);
		} catch (error) {
			console.error("Error loading time entry details:", error);
			Alert.alert("Error", "Failed to load time entry details");
		} finally {
			setIsLoading(false);
		}
	};

	// Load data on mount
	useEffect(() => {
		loadTimeEntries();
	}, [entryIds.join(","), companyId]);

	// Recalculate field totals when entries change
	useEffect(() => {
		if (timeEntries.length > 0) {
			const totals = calculateFieldTotals(timeEntries);
			setFieldTotals(totals);
		}
	}, [timeEntries]);

	return {
		timeEntries,
		employeeUser,
		connectedEvents,
		attachmentMap,
		fieldTotals,
		totalDurationSeconds,
		totalDurationDecimal,
		isLoading,
		refetch: loadTimeEntries,
	};
};
