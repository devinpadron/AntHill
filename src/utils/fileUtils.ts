import { Platform } from "react-native";
import DocumentPicker from "react-native-document-picker";
import * as ImagePicker from "react-native-image-picker";
import storage from "@react-native-firebase/storage";
import { FileUpload } from "../types";

export const uploadFile = async (
	file: FileUpload,
	eventId: string,
	companyId: string,
): Promise<FileUpload> => {
	try {
		const fileCategory = file.type.startsWith("image/")
			? "images"
			: "documents";
		const storagePath = `companies/${companyId}/events/${eventId}/${fileCategory}/${file.name}`;
		const storageRef = storage().ref(storagePath);

		const uploadUri =
			Platform.OS === "ios" ? file.uri.replace("file://", "") : file.uri;

		const task = storageRef.putFile(uploadUri);

		// Monitor upload progress (optional)
		task.on("state_changed", (snapshot) => {
			const progress =
				(snapshot.bytesTransferred / snapshot.totalBytes) * 100;
			console.log(`Upload is ${progress}% complete`);
		});

		await task;
		const url = await storageRef.getDownloadURL();

		return {
			...file,
			url,
			path: storagePath,
			uploadTime: Date.now(),
		};
	} catch (error) {
		console.error("Upload error:", error);
		throw error;
	}
};

export const pickDocuments = async (): Promise<FileUpload[]> => {
	try {
		const results = await DocumentPicker.pick({
			type: [DocumentPicker.types.images, DocumentPicker.types.pdf],
			allowMultiSelection: true,
		});

		return results.map((file) => ({
			uri: file.uri,
			name: file.name,
			type: file.type,
		}));
	} catch (err) {
		if (!DocumentPicker.isCancel(err)) {
			console.error(err);
		}
		return [];
	}
};

export const pickImages = async (): Promise<FileUpload[]> => {
	const options: ImagePicker.ImageLibraryOptions = {
		mediaType: "photo",
		quality: 0.8,
		selectionLimit: 0,
	};

	try {
		const response = await ImagePicker.launchImageLibrary(options);

		if (response.assets) {
			return response.assets
				.filter((asset) => asset.uri && asset.fileName)
				.map((asset) => ({
					uri: asset.uri!,
					name: asset.fileName!,
					type: asset.type || "image/jpeg",
				}));
		}

		return [];
	} catch (err) {
		console.error(err);
		return [];
	}
};
