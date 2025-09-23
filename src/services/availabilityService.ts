import db from "../constants/firestore";
import { arrayUnion } from "firebase/firestore";

/**
 * Fetches events that are scheduled for today or later and have no assigned workers
 * @param companyId The ID of the company
 * @returns Array of unassigned upcoming events
 */
export async function fetchUnassignedUpcomingEvents(companyId: string) {
	try {
		const today = new Date();
		const todayFormatted = today.toISOString().split("T")[0];
		// Reference to the events subcollection
		const eventsRef = db
			.collection("Companies")
			.doc(companyId)
			.collection("Events");

		// Query events where date is today or later and assignedWorkers is null
		const querySnapshot = await eventsRef
			.where("date", ">=", todayFormatted)
			.where("assignedWorkers", "==", [])
			.get();

		// Map the query results to an array of event objects
		const events = querySnapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data(),
		}));

		return events;
	} catch (error) {
		console.error("Error fetching unassigned upcoming events:", error);
		throw error;
	}
}

export async function fetchAllUserAssignedEvents(
	companyId: string,
	userId: string,
) {
	try {
		const eventsRef = db
			.collection("Companies")
			.doc(companyId)
			.collection("Events");

		// Query events where assignedWorkers array contains the userId
		const querySnapshot = await eventsRef
			.where("assignedWorkers", "array-contains", userId)
			.get();

		// Map the query results to an array of event objects
		const events = querySnapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data(),
		}));

		return events;
	} catch (error) {
		console.error("Error fetching user assigned events:", error);
		throw error;
	}
}

export async function confirmEvent(
	companyId: string,
	eventId: string,
	userId: string,
) {
	try {
		const eventRef = db
			.collection("Companies")
			.doc(companyId)
			.collection("Events")
			.doc(eventId);

		const eventDoc = await eventRef.get();
		const eventData = eventDoc.data();
		await eventRef.update({
			workerStatus: {
				...eventData.workerStatus,
				[userId]: "confirmed",
			},
		});
	} catch (error) {
		console.error("Error confirming event:", error);
		throw error;
	}
}

export async function declineEvent(
	companyId: string,
	eventId: string,
	userId: string,
) {
	try {
		const eventRef = db
			.collection("Companies")
			.doc(companyId)
			.collection("Events")
			.doc(eventId);

		const eventDoc = await eventRef.get();
		const eventData = eventDoc.data();

		await eventRef.update({
			workerStatus: {
				...eventData.workerStatus,
				[userId]: "declined",
			},
		});
	} catch (error) {
		console.error("Error declining event:", error);
		throw error;
	}
}

export async function undeclineEvent(
	companyId: string,
	eventId: string,
	userId: string,
) {
	try {
		const eventRef = db
			.collection("Companies")
			.doc(companyId)
			.collection("Events")
			.doc(eventId);

		const eventDoc = await eventRef.get();
		const eventData = eventDoc.data();

		await eventRef.update({
			workerStatus: {
				...eventData.workerStatus,
				[userId]: "pending",
			},
		});
	} catch (error) {
		console.error("Error undeclining event:", error);
		throw error;
	}
}
