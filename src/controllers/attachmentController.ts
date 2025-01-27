import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import db from "../../index";
import { FileUpload } from "../screens/settings/EventSubmit";

export async function addAttachments(
	company: string,
	eventId: string,
	attachments: FileUpload[]
) {
	try {
		const batch = db.batch();
		const attachmentsRef = db
			.collection("Companies")
			.doc(company)
			.collection("Events")
			.doc(eventId)
			.collection("Attachments");

		for (const attachment of attachments) {
			const docRef = attachmentsRef.doc();
			batch.set(docRef, {
				filename: attachment.name,
				url: attachment.url,
				type: attachment.type,
				uploadTime: attachment.uploadTime,
				path: attachment.path,
			});
		}

		await batch.commit();
		return true;
	} catch (e) {
		console.error("Error adding attachments:", e);
		throw e;
	}
}

export async function getEventAttachments(
	company: string,
	eventId: string
): Promise<FileUpload[]> {
	try {
		const attachmentsSnapshot = await db
			.collection("Companies")
			.doc(company)
			.collection("Events")
			.doc(eventId)
			.collection("Attachments")
			.get();

		return attachmentsSnapshot.docs.map((doc) => doc.data() as FileUpload);
	} catch (e) {
		console.error("Error getting attachments:", e);
		throw e;
	}
}

export function subscribeEventAttachments(
	company: string,
	eventId: string,
	onSnap: (
		snapshot: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>
	) => void
) {
	return db
		.collection("Companies")
		.doc(company)
		.collection("Events")
		.doc(eventId)
		.collection("Attachments")
		.onSnapshot(onSnap);
}

export async function deleteEventAttachments(company: string, eventId: string) {
	try {
		const attachmentsSnapshot = await db
			.collection("Companies")
			.doc(company)
			.collection("Events")
			.doc(eventId)
			.collection("Attachments")
			.get();

		const batch = db.batch();
		attachmentsSnapshot.docs.forEach((doc) => {
			batch.delete(doc.ref);
		});

		await batch.commit();
		return true;
	} catch (e) {
		console.error("Error deleting attachments:", e);
		throw e;
	}
}
