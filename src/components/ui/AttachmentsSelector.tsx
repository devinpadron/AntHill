import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	Platform,
	ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import ThumbnailGallery from "./ThumbnailGallery";
/*
 * The picker holds a MIX: files already persisted and files just chosen.
 *
 * v1 used one `SelectableAttachment` with an `isExisting` flag, which is why every
 * consumer needed `downloadUrl || uri` fallbacks. Here `kind` states which it
 * is, while the display fields are uniform — so rendering never has to ask,
 * but upload and delete can.
 */
import { UploadProgressMap } from "../../contexts/UploadManagerContext";
import { Theme, useTheme, useThemedStyles } from "../../theme";

export type SelectableAttachment = {
	id: string;
	kind: "persisted" | "draft";
	fileName: string;
	contentType: string;
	sizeBytes: number;
	/** downloadUrl for persisted files, local uri for drafts. */
	displayUri: string;
	thumbnailUri?: string | null;
	width?: number;
	height?: number;
};

interface AttachmentsSelectorProps {
	// Content configuration
	showDocuments?: boolean;
	showMedia?: boolean;

	// Combined state management
	attachments: SelectableAttachment[];
	setAttachments: (attachments: SelectableAttachment[]) => void;

	// Deletion queue for existing attachments
	deletionQueue: string[];
	setDeletionQueue: (ids: string[]) => void;
	uploadProgress?: UploadProgressMap;
}

const AttachmentsSelector: React.FC<AttachmentsSelectorProps> = ({
	showDocuments = true,
	showMedia = true,
	attachments = [],
	setAttachments,
	deletionQueue = [],
	setDeletionQueue,
	uploadProgress = {},
}) => {
	const theme = useTheme();
	const styles = useThemedStyles(selectorStyles);
	// Loading states
	const [loadingDocuments, setLoadingDocuments] = useState(false);
	const [loadingMedia, setLoadingMedia] = useState(false);

	// Filter attachments by type
	const fileAttachments = attachments.filter(
		(item) =>
			!item.contentType.startsWith("image/") &&
			!item.contentType.startsWith("video/"),
	);

	const mediaAttachments = attachments.filter(
		(item) =>
			item.contentType.startsWith("image/") ||
			item.contentType.startsWith("video/"),
	);

	// Request permissions for camera and media library
	const requestMediaPermissions = async () => {
		if (Platform.OS !== "web") {
			const { status } =
				await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (status !== "granted") {
				alert(
					"Sorry, we need camera roll permissions to make this work!",
				);
				return false;
			}
			return true;
		}
		return true;
	};

	// Generate video thumbnail
	const generateVideoThumbnail = async (
		videoUri: string,
	): Promise<string | null> => {
		try {
			const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
				time: 1000, // Get thumbnail from 1 second into video
				quality: 0.5,
			});
			return uri;
		} catch (error) {
			console.error("Error generating video thumbnail:", error);
			return null;
		}
	};

	// Handle document selection
	const handleDocumentSelect = async () => {
		setLoadingDocuments(true);
		try {
			const result = await DocumentPicker.getDocumentAsync({
				type: "*/*",
				copyToCacheDirectory: true,
				multiple: true,
			});

			if (result.canceled) {
				setLoadingDocuments(false);
				return;
			}

			const newFiles: SelectableAttachment[] = result.assets.map(
				(asset) => ({
					id: `file-${Date.now()}-${Math.random()
						.toString(36)
						.substring(2, 9)}`,
					kind: "draft",
					displayUri: asset.uri,
					fileName: asset.name || "Unnamed document",
					contentType: asset.mimeType || "application/octet-stream",
					sizeBytes: asset.size || 0,
				}),
			);

			setAttachments([...attachments, ...newFiles]);
		} catch (error) {
			console.error("Error selecting document:", error);
		} finally {
			setLoadingDocuments(false);
		}
	};

	// Handle media selection
	const handleMediaSelect = async () => {
		setLoadingMedia(true);
		const hasPermission = await requestMediaPermissions();
		if (!hasPermission) {
			setLoadingMedia(false);
			return;
		}

		try {
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ["images", "videos"],
				allowsMultipleSelection: true,
				quality: 0.5,
				preferredAssetRepresentationMode:
					ImagePicker.UIImagePickerPreferredAssetRepresentationMode
						.Current,
			});

			if (result.canceled) {
				setLoadingMedia(false);
				return;
			}

			// Process each asset, generating thumbnails for videos
			const newMediaPromises = result.assets.map(async (asset) => {
				const isVideo = asset.type === "video";
				let thumbnailUri = null;

				// Generate thumbnail for videos
				if (isVideo) {
					thumbnailUri = await generateVideoThumbnail(asset.uri);
				}

				const media: SelectableAttachment = {
					id: `media-${Date.now()}-${Math.random()
						.toString(36)
						.substring(2, 9)}`,
					kind: "draft",
					displayUri: asset.uri,
					fileName: asset.fileName || "Unnamed media",
					contentType: isVideo ? "video/mp4" : "image/jpeg",
					sizeBytes: asset.fileSize || 0,
					width: asset.width,
					height: asset.height,
					thumbnailUri,
				};
				return media;
			});

			// Wait for all assets to be processed
			const newMedia = await Promise.all(newMediaPromises);

			setAttachments([...attachments, ...newMedia]);
		} catch (error) {
			console.error("Error selecting media:", error);
		} finally {
			setLoadingMedia(false);
		}
	};

	// Handle deletion of an item
	const handleDeleteItem = (id: string, isExisting: boolean) => {
		if (isExisting) {
			// Add to deletion queue if it's an existing item
			setDeletionQueue([...deletionQueue, id]);
		} else {
			// Remove from local state if it's a new item
			setAttachments(attachments.filter((item) => item.id !== id));
		}
	};

	// Handle restoration of an item marked for deletion
	const handleRestoreItem = (id: string) => {
		setDeletionQueue(deletionQueue.filter((itemId) => itemId !== id));
	};

	return (
		<View style={styles.container}>
			<View style={styles.buttonsContainer}>
				{showDocuments && (
					<TouchableOpacity
						style={styles.attachButton}
						onPress={handleDocumentSelect}
						disabled={loadingDocuments}
					>
						{loadingDocuments ? (
							<ActivityIndicator
								size="small"
								color={theme.colors.accent}
							/>
						) : (
							<Ionicons
								name="document-outline"
								size={22}
								color={theme.colors.accent}
							/>
						)}
						<Text style={styles.attachButtonText}>
							{loadingDocuments ? "Loading..." : "Documents"}
						</Text>
					</TouchableOpacity>
				)}

				{showMedia && (
					<TouchableOpacity
						style={styles.attachButton}
						onPress={handleMediaSelect}
						disabled={loadingMedia}
					>
						{loadingMedia ? (
							<ActivityIndicator
								size="small"
								color={theme.colors.accent}
							/>
						) : (
							<Ionicons
								name="image-outline"
								size={22}
								color={theme.colors.accent}
							/>
						)}
						<Text style={styles.attachButtonText}>
							{loadingMedia ? "Loading..." : "Photos & Videos"}
						</Text>
					</TouchableOpacity>
				)}
			</View>

			<ThumbnailGallery
				files={fileAttachments}
				media={mediaAttachments}
				deletionQueue={deletionQueue}
				onDelete={handleDeleteItem}
				onRestore={handleRestoreItem}
				uploadProgress={uploadProgress}
			/>
		</View>
	);
};

const selectorStyles = (theme: Theme) =>
	StyleSheet.create({
		container: {
			marginTop: 8,
		},
		buttonsContainer: {
			flexDirection: "row",
			flexWrap: "wrap",
			marginBottom: 12,
			gap: 10,
		},
		attachButton: {
			flexDirection: "row",
			alignItems: "center",
			backgroundColor: theme.colors.accentSubtle,
			paddingVertical: 10,
			paddingHorizontal: 16,
			borderRadius: 8,
			borderWidth: 1,
			borderColor: theme.colors.accentBorder,
			minWidth: 140,
		},
		attachButtonText: {
			color: theme.colors.accent,
			marginLeft: 8,
			fontWeight: "500",
		},
	});

export default AttachmentsSelector;
