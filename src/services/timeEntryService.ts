import db from "../constants/firestore";
import { AttachmentItem, TimeEntry } from "../types";
import * as FileSystem from "expo-file-system";

export const clockIn = async (userId: string, companyId: string) => {
	const timeEntryRef = db
		.collection("Companies")
		.doc(companyId)
		.collection("TimeEntries")
		.doc();

	const timeEntry = {
		id: timeEntryRef.id,
		userId,
		companyId,
		clockInTime: new Date().toISOString(),
		status: "active",
	};

	await timeEntryRef.set(timeEntry);
	return timeEntry;
};

export const clockOut = async (timeEntryId: string, companyId: string) => {
	const clockOutTime = new Date().toISOString();

	try {
		const timeEntryRef = db
			.collection("Companies")
			.doc(companyId)
			.collection("TimeEntries")
			.doc(timeEntryId);

		const doc = await timeEntryRef.get();
		if (!doc.exists) {
			throw new Error("Time entry not found");
		}

		const timeEntry = doc.data();
		const startTime = new Date(timeEntry.clockInTime);
		const endTime = new Date(clockOutTime);

		// Calculate raw duration in seconds (not minutes)
		const rawDurationSeconds = Math.round(
			(endTime.getTime() - startTime.getTime()) / 1000,
		);

		// Calculate actual billable duration by subtracting paused time
		let actualDuration = rawDurationSeconds;

		// Deduct accumulated paused time (now in seconds)
		if (timeEntry.totalPausedSeconds) {
			actualDuration -= timeEntry.totalPausedSeconds;
		}

		// If we're currently paused, calculate the current pause duration too
		if (timeEntry.status === "paused" && timeEntry.pauseStartTime) {
			const currentPauseDuration = Math.round(
				(endTime.getTime() -
					new Date(timeEntry.pauseStartTime).getTime()) /
					1000,
			);
			actualDuration -= currentPauseDuration;
		}

		// Ensure we don't have negative duration
		const duration = Math.max(0, actualDuration);

		await timeEntryRef.update({
			clockOutTime,
			duration,
			status: "completed",
		});

		return { ...timeEntry, clockOutTime, duration, status: "completed" };
	} catch (error) {
		console.error("Error clocking out:", error);
		throw error;
	}
};

export const getActiveTimeEntry = async (userId: string, companyId: string) => {
	const timeEntriesRef = db
		.collection("Companies")
		.doc(companyId)
		.collection("TimeEntries")
		.where("userId", "==", userId)
		.where("status", "==", "active");

	const snapshot = await timeEntriesRef.get();
	if (snapshot.empty) return null;

	const timeEntryDoc = snapshot.docs[0];
	return { id: timeEntryDoc.id, ...timeEntryDoc.data() };
};

export const getTimeEntries = async (
	userId: string,
	companyId: string,
	startDate: Date,
	endDate: Date,
) => {
	let timeEntriesRef = db
		.collection("Companies")
		.doc(companyId)
		.collection("TimeEntries")
		.where("userId", "==", userId)
		.where("clockInTime", ">=", startDate.toISOString())
		.where("clockInTime", "<=", endDate.toISOString());

	// Always sort by clockInTime in descending order and limit results
	timeEntriesRef = timeEntriesRef.orderBy("clockInTime", "desc");

	const snapshot = await timeEntriesRef.get();
	if (snapshot.empty) return [];

	return snapshot.docs.map((doc) => ({
		id: doc.id,
		...doc.data(),
	})) as any;
};

export async function getTimeEntryAttachments(
	company: string,
	timeEntryId: string,
): Promise<AttachmentItem[]> {
	const timeEntry = await db
		.collection("Companies")
		.doc(company)
		.collection("TimeEntries")
		.doc(timeEntryId)
		.collection("Attachments")
		.get();
	const attachments: AttachmentItem[] = [];
	timeEntry.forEach((attachment) => {
		const attachmentData = attachment.data() as AttachmentItem;
		attachments.push({
			...attachmentData,
			isExisting: true,
		});
	});

	return attachments;
}

export const subscribeToActiveTimeEntry = (
	userId: string,
	companyId: string,
	callback: (activeEntry: TimeEntry | null) => void,
) => {
	if (!userId || !companyId) return () => {};

	const unsubscribe = db
		.collection("Companies")
		.doc(companyId)
		.collection("TimeEntries")
		.where("userId", "==", userId)
		.where("status", "in", ["active", "paused"]) // Listen for both active and paused
		.onSnapshot(
			(snapshot) => {
				const activeEntries = snapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				})) as TimeEntry[];

				const active = activeEntries[0] || null;
				callback(active);
			},
			(error) => {
				console.error(
					"Error subscribing to active time entries:",
					error,
				);
				callback(null);
			},
		);

	return unsubscribe;
};

export const getAllTimeEntries = async (
	userId: string | null,
	companyId: string,
	startDate?: string,
	endDate?: string,
	limit = 50,
) => {
	try {
		// Start with the collection reference
		const collectionRef = db
			.collection("Companies")
			.doc(companyId)
			.collection("TimeEntries");

		// Build the query step by step
		let queryRef = collectionRef as any; // Start with a flexible type

		// Add userId filter if provided
		if (userId) {
			queryRef = queryRef.where("userId", "==", userId);
		}

		// Add date range filters if provided
		if (startDate && endDate) {
			queryRef = queryRef.where("clockInTime", ">=", startDate);
			queryRef = queryRef.where("clockInTime", "<=", endDate);
		}

		// Always sort by clockInTime in descending order and limit results
		queryRef = queryRef.orderBy("clockInTime", "desc").limit(limit);

		// Execute the query
		const snapshot = await queryRef.get();

		if (snapshot.empty) return [];

		return snapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data(),
		})) as TimeEntry[];
	} catch (error) {
		console.error("Error getting time entries:", error);
		throw error;
	}
};

// Pause time entry
export const pauseTimeEntry = async (
	timeEntryId: string,
	companyId: string,
) => {
	const pauseTime = new Date().toISOString();

	try {
		await db
			.collection("Companies")
			.doc(companyId)
			.collection("TimeEntries")
			.doc(timeEntryId)
			.update({
				status: "paused",
				pauseStartTime: pauseTime,
			});

		return { success: true };
	} catch (error) {
		console.error("Error pausing time entry:", error);
		throw error;
	}
};

// Resume time entry
export const resumeTimeEntry = async (
	timeEntryId: string,
	companyId: string,
) => {
	try {
		// Get the current entry to calculate pause duration
		const entryRef = db
			.collection("Companies")
			.doc(companyId)
			.collection("TimeEntries")
			.doc(timeEntryId);

		const doc = await entryRef.get();

		if (!doc.exists) {
			throw new Error("Time entry not found");
		}

		const entry = doc.data();
		const pauseStartTime = entry.pauseStartTime;

		if (!pauseStartTime) {
			throw new Error("No pause start time recorded");
		}

		// Calculate pause duration in seconds (not minutes)
		const pauseDurationSeconds = Math.round(
			(new Date().getTime() - new Date(pauseStartTime).getTime()) / 1000,
		);

		// Update entry with accumulated pause time in seconds
		const totalPausedSeconds =
			(entry.totalPausedSeconds || 0) + pauseDurationSeconds;

		await entryRef.update({
			status: "active",
			pauseStartTime: null, // Clear pause start time
			totalPausedSeconds: totalPausedSeconds,
		});

		return { success: true, totalPausedSeconds };
	} catch (error) {
		console.error("Error resuming time entry:", error);
		throw error;
	}
};

// Submit time entry for approval
export const submitTimeEntryForApproval = async (
	timeEntryId: string,
	companyId: string,
	entry: any,
) => {
	try {
		const timeEntryRef = db
			.collection("Companies")
			.doc(companyId)
			.collection("TimeEntries")
			.doc(timeEntryId);

		const timestamp = new Date().toISOString();

		await timeEntryRef.update(entry);

		return {
			success: true,
			message: "Time entry submitted for approval",
		};
	} catch (error) {
		console.error("Error submitting time entry:", error);
		throw error;
	}
};

export const getTimeEntry = async (companyId: string, timeEntryId: string) => {
	try {
		const doc = await db
			.collection("Companies")
			.doc(companyId)
			.collection("TimeEntries")
			.doc(timeEntryId)
			.get();

		if (!doc.exists) {
			return null;
		}

		return { id: doc.id, ...doc.data() } as TimeEntry;
	} catch (error) {
		console.error("Error getting time entry:", error);
		throw error;
	}
};

export const updateTimeEntry = async (
	timeEntryId: string,
	companyId: string,
	updates: any,
) => {
	try {
		await db
			.collection("Companies")
			.doc(companyId)
			.collection("TimeEntries")
			.doc(timeEntryId)
			.update(updates);

		return { success: true };
	} catch (error) {
		console.error("Error updating time entry:", error);
		throw error;
	}
};

export const approveTimeEntry = async (
	timeEntryId: string,
	companyId: string,
	approvalData: any,
) => {
	try {
		await db
			.collection("Companies")
			.doc(companyId)
			.collection("TimeEntries")
			.doc(timeEntryId)
			.update(approvalData);

		return { success: true };
	} catch (error) {
		console.error("Error approving time entry:", error);
		throw error;
	}
};

export const exportTimeEntries = async (
	companyId: string,
	timeEntryIds: string[],
	format: string = "txt",
	employeeName: string = "Employee",
	customForm?: any, // Add customForm parameter to access field definitions
) => {
	try {
		const entries = await Promise.all(
			timeEntryIds.map((id) => getTimeEntry(companyId, id)),
		);

		let content = "";
		let fileName = "";

		if (format === "txt") {
			// Instead of a PDF, create a well-formatted text file
			content = `TIME ENTRY REPORT FOR ${employeeName.toUpperCase()}\n`;
			content += `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
			content += `=================================================\n\n`;

			entries.forEach((entry) => {
				// Basic time entry details
				content += `ENTRY ID: ${entry.id}\n`;
				content += `DATE: ${new Date(
					entry.clockInTime,
				).toLocaleDateString()}\n`;
				content += `CLOCK IN: ${new Date(
					entry.clockInTime,
				).toLocaleTimeString()}\n`;
				content += `CLOCK OUT: ${
					entry.clockOutTime
						? new Date(entry.clockOutTime).toLocaleTimeString()
						: "N/A"
				}\n`;
				content += `DURATION: ${(entry.duration / 3600).toFixed(
					2,
				)} hours\n`;
				content += `STATUS: ${entry.status}\n`;

				// Add notes if they exist
				if (entry.notes) {
					content += `\nNOTES:\n${entry.notes}\n`;
				}

				// Add form responses with proper labels
				if (
					entry.formResponses &&
					Object.keys(entry.formResponses).length > 0
				) {
					content += "\nFORM RESPONSES:\n";
					Object.entries(customForm[entry.id]).forEach(
						([fieldLabel, value]) => {
							// Try to get the label from customForm if available

							content += `- ${fieldLabel}: ${value}\n`;
						},
					);
				}

				// Add edit history if it exists
				if (entry.editHistory && entry.editHistory.length > 0) {
					content += "\nEDIT HISTORY:\n";
					entry.editHistory.forEach((edit: any) => {
						content += `- ${new Date(
							edit.timestamp,
						).toLocaleString()} by ${
							edit.editor.displayName || "Unknown"
						}\n`;
						if (edit.summary) {
							content += `  Summary: ${edit.summary}\n`;
						}
						if (edit.changes) {
							content += `  Changes: ${JSON.stringify(
								edit.changes,
							)}\n`;
						}
					});
				}

				content +=
					"\n-------------------------------------------------\n\n";
			});

			fileName = `${employeeName.replace(/\s+/g, "_")}_time_entries.txt`;
		} else if (format === "csv") {
			content =
				"Date,Clock In,Clock Out,Duration (hours),Status,Notes,Form Responses,Edit History\n";

			entries.forEach((entry) => {
				const date = new Date(entry.clockInTime).toLocaleDateString();
				const clockIn = new Date(
					entry.clockInTime,
				).toLocaleTimeString();
				const clockOut = entry.clockOutTime
					? new Date(entry.clockOutTime).toLocaleTimeString()
					: "N/A";
				const duration = (entry.duration / 3600).toFixed(2);

				// Escape any commas in text fields
				const notes = entry.notes
					? `"${entry.notes.replace(/"/g, '""')}"`
					: "";

				// Format form responses using the field label mapping
				let formResponsesStr = "";
				if (
					entry.formResponses &&
					Object.keys(entry.formResponses).length > 0
				) {
					formResponsesStr =
						'"' +
						Object.entries(customForm[entry.id])
							.map(([fieldLabel, value]) => {
								// Use the label from our mapping if available, otherwise use the ID
								return `${fieldLabel}: ${value}`;
							})
							.join("; ")
							.replace(/"/g, '""') +
						'"';
				}

				// Format edit history (unchanged)
				let editHistoryStr = "";
				if (entry.editHistory && entry.editHistory.length > 0) {
					editHistoryStr =
						'"' +
						entry.editHistory
							.map(
								(edit: any) =>
									`${new Date(
										edit.timestamp,
									).toLocaleString()} - ${
										edit.summary || "Edited"
									}`,
							)
							.join("; ")
							.replace(/"/g, '""') +
						'"';
				}

				content += `${date},${clockIn},${clockOut},${duration},${entry.status},${notes},${formResponsesStr},${editHistoryStr}\n`;
			});

			fileName = `${employeeName.replace(/\s+/g, "_")}_time_entries.csv`;
		}

		// Save file using expo-file-system
		const fileUri = FileSystem.documentDirectory + fileName;
		await FileSystem.writeAsStringAsync(fileUri, content);

		return fileUri;
	} catch (error) {
		console.error("Error exporting time entries:", error);
		throw error;
	}
};

export const deleteTimeEntry = async (
	timeEntryId: string,
	companyId: string,
) => {
	try {
		await db
			.collection("Companies")
			.doc(companyId)
			.collection("TimeEntries")
			.doc(timeEntryId)
			.delete();
		return { success: true };
	} catch (error) {
		console.error("Error deleting time entry:", error);
		throw error;
	}
};
