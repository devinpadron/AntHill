import { Platform } from "react-native";
import DocumentPicker from "react-native-document-picker";
import * as ImagePicker from "react-native-image-picker";
import storage from "@react-native-firebase/storage";
import { FileUpload } from "../types";
import * as VideoThumbnails from "expo-video-thumbnails";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

// Updated function to generate thumbnails for videos
export const generateVideoThumbnail = async (
	videoUri: string,
): Promise<string | null> => {
	try {
		// Generate thumbnail from video
		const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
			time: 1000,
			quality: 0.5,
		});

		// Compress the thumbnail using current API
		const context = ImageManipulator.manipulate(uri);
		context.resize({ width: 300 });
		const image = await context.renderAsync();
		const result = await image.saveAsync({
			compress: 0.7,
			format: SaveFormat.JPEG,
		});

		return result.uri;
	} catch (e) {
		console.error("Error generating video thumbnail:", e);
		return null;
	}
};

export const uploadFile = async (
	file: FileUpload,
	eventId: string,
	companyId: string,
	onProgress?: (uri: string, progress: number) => void, // Add progress callback
): Promise<FileUpload> => {
	try {
		// Determine file category based on type
		let fileCategory = "documents";
		if (file.type.startsWith("image/")) {
			fileCategory = "images";
		} else if (file.type.startsWith("video/")) {
			fileCategory = "videos";
		}

		const storagePath = `companies/${companyId}/events/${eventId}/${fileCategory}/${file.name}`;
		const storageRef = storage().ref(storagePath);

		// Generate thumbnail for videos
		let thumbnailUrl = null;
		let thumbnailPath = null;
		if (file.type.startsWith("video/")) {
			const thumbnailUri = await generateVideoThumbnail(file.uri);
			if (thumbnailUri) {
				thumbnailPath = `companies/${companyId}/events/${eventId}/thumbnails/${file.name.replace(
					/\.[^/.]+$/,
					"",
				)}_thumb.jpg`;
				const thumbnailRef = storage().ref(thumbnailPath);
				const thumbnailUploadUri =
					Platform.OS === "ios"
						? thumbnailUri.replace("file://", "")
						: thumbnailUri;

				await thumbnailRef.putFile(thumbnailUploadUri);
				thumbnailUrl = await thumbnailRef.getDownloadURL();
			}
		}

		const uploadUri =
			Platform.OS === "ios" ? file.uri.replace("file://", "") : file.uri;
		const task = storageRef.putFile(uploadUri);

		// Monitor upload progress with callback
		task.on("state_changed", (snapshot) => {
			const progress =
				(snapshot.bytesTransferred / snapshot.totalBytes) * 100;
			console.log(`Upload is ${progress}% complete`);

			// Call the progress callback if provided
			if (onProgress) {
				onProgress(file.uri, progress);
			}
		});

		await task;
		const url = await storageRef.getDownloadURL();

		return {
			...file,
			url,
			path: storagePath,
			uploadTime: Date.now(),
			...(thumbnailUrl && { thumbnailUrl }),
			thumbnailPath,
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

//TODO: Switch to a different library for image picking cuz this is slow af
export const pickMedia = async (limit = 10): Promise<FileUpload[]> => {
	// Add loading indicator in UI where this function is called

	const options: ImagePicker.ImageLibraryOptions = {
		mediaType: "mixed",
		quality: 0.7, // Reduced quality
		selectionLimit: limit, // Limit selection count
		videoQuality: "low", // Lower video quality
		includeBase64: false, // Ensure this is off
		maxWidth: 1200, // Limit image dimensions
		maxHeight: 1200,
	};

	try {
		const response = await ImagePicker.launchImageLibrary(options);

		if (response.assets) {
			return response.assets
				.filter((asset) => asset.uri && asset.fileName)
				.map((asset) => ({
					uri: asset.uri!,
					name: asset.fileName!,
					type:
						asset.type ||
						(asset.uri?.includes("video")
							? "video/mp4"
							: "image/jpeg"),
					url: asset.uri,
					size: asset.fileSize, // Track file size
					...(asset.duration && { duration: asset.duration }),
				}));
		}

		return [];
	} catch (err) {
		console.error("Media picker error:", err);
		return [];
	}
};
