import db from "../constants/firestore";
import { TimeEntry } from "../types";

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
	const timeEntryRef = db
		.collection("Companies")
		.doc(companyId)
		.collection("TimeEntries")
		.doc(timeEntryId);

	const timeEntryDoc = await timeEntryRef.get();
	const timeEntry = timeEntryDoc.data();

	const duration = differenceInMinutes(
		new Date(clockOutTime),
		new Date(timeEntry.clockInTime),
	);

	await timeEntryRef.update({
		clockOutTime,
		duration,
		status: "completed",
	});

	return { ...timeEntry, clockOutTime, duration, status: "completed" };
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

function differenceInMinutes(clockOut: Date, clockIn: Date) {
	return Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000);
}

export const getTimeEntries = async (
	userId: string,
	companyId: string,
	startDate: Date,
	endDate: Date,
) => {
	const timeEntriesRef = db
		.collection("Companies")
		.doc(companyId)
		.collection("TimeEntries")
		.where("userId", "==", userId)
		.where("clockInTime", ">=", startDate.toISOString())
		.where("clockInTime", "<=", endDate.toISOString());

	const snapshot = await timeEntriesRef.get();
	if (snapshot.empty) return [];

	return snapshot.docs.map((doc) => ({
		id: doc.id,
		...doc.data(),
	}));
};

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
		.where("status", "==", "active")
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
	userId: string,
	companyId: string,
	limit = 50,
) => {
	const timeEntriesRef = db
		.collection("Companies")
		.doc(companyId)
		.collection("TimeEntries")
		.where("userId", "==", userId)
		.orderBy("clockInTime", "desc")
		.limit(limit);

	const snapshot = await timeEntriesRef.get();
	if (snapshot.empty) return [];

	return snapshot.docs.map((doc) => ({
		id: doc.id,
		...doc.data(),
	})) as TimeEntry[];
};
