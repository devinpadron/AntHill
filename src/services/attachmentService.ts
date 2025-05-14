import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import db from "../constants/firestore";
import { FileUpload } from "../types";
import storage from "@react-native-firebase/storage";

export async function addAttachments(
	company: string,
	eventId: string,
	attachments: FileUpload[],
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
				name: attachment.name,
				url: attachment.url,
				type: attachment.type,
				uploadTime: attachment.uploadTime,
				path: attachment.path,
				id: docRef.id,
				duration: attachment.duration,
				thumbnailUrl: attachment.thumbnailUrl,
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
	eventId: string,
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
		snapshot: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>,
	) => void,
) {
	return db
		.collection("Companies")
		.doc(company)
		.collection("Events")
		.doc(eventId)
		.collection("Attachments")
		.onSnapshot(onSnap);
}

export async function deleteEventAttachments(
	company: string,
	eventId: string,
	attachments: string[],
) {
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
			if (attachments.find((attachment) => attachment === doc.id)) {
				storage().ref(doc.data().path).delete();
				batch.delete(doc.ref);
			}
		});

		await batch.commit();
		return true;
	} catch (e) {
		console.error("Error deleting attachments:", e);
		throw e;
	}
}
