import React from "react";
import {
	View,
	Text,
	Image,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Dimensions,
	ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AttachmentItem } from "../../types";
import { UploadProgressMap } from "../../contexts/UploadManagerContext";

interface ThumbnailGalleryProps {
	files: AttachmentItem[];
	media: AttachmentItem[];
	deletionQueue: string[];
	uploadProgress?: UploadProgressMap;
	onDelete: (id: string, isMediaItem: boolean, isExisting: boolean) => void;
	onRestore: (id: string) => void;
}

const ThumbnailGallery: React.FC<ThumbnailGalleryProps> = ({
	files,
	media,
	deletionQueue,
	uploadProgress = {},
	onDelete,
	onRestore,
}) => {
	const windowWidth = Dimensions.get("window").width;
	const numColumns = windowWidth > 600 ? 5 : 3;
	const thumbnailSize = (windowWidth - 60) / numColumns;

	// Helper to get file icon based on mime type
	const getFileIcon = (mimeType: string) => {
		if (mimeType.includes("pdf")) return "document-text-outline";
		if (mimeType.includes("word") || mimeType.includes("msword"))
			return "document-outline";
		if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
			return "grid-outline";
		if (
			mimeType.includes("presentation") ||
			mimeType.includes("powerpoint")
		)
			return "easel-outline";
		return "document-outline";
	};

	// Check if an item is marked for deletion
	const isMarkedForDeletion = (id: string) => deletionQueue.includes(id);

	// Render upload progress overlay
	const renderProgressOverlay = (id: string) => {
		const fileProgress = uploadProgress[id];

		if (!fileProgress) return null;

		if (fileProgress.status === "error") {
			return (
				<View style={styles.progressOverlay}>
					<Ionicons name="alert-circle" size={24} color="#e74c3c" />
					<Text style={styles.errorText}>Error</Text>
				</View>
			);
		}

		if (
			fileProgress.status === "uploading" ||
			fileProgress.status === "pending"
		) {
			return (
				<View style={styles.progressOverlay}>
					<View style={styles.progressBarContainer}>
						<View
							style={[
								styles.progressBar,
								{ width: `${fileProgress.progress}%` },
							]}
						/>
					</View>
					<Text style={styles.progressText}>
						{Math.round(fileProgress.progress)}%
					</Text>
				</View>
			);
		}

		if (fileProgress.status === "complete" && fileProgress.progress < 100) {
			return (
				<View style={styles.progressOverlay}>
					<ActivityIndicator size="small" color="#3d7eea" />
					<Text style={styles.progressText}>Processing...</Text>
				</View>
			);
		}

		return null;
	};

	// No attachments view
	if (files.length === 0 && media.length === 0) {
		return null;
	}

	return (
		<View style={styles.container}>
			<Text style={styles.galleryTitle}>Attachments</Text>
			<ScrollView
				horizontal={false}
				contentContainerStyle={styles.galleryContainer}
			>
				{/* Media thumbnails */}
				{media.map((item) => {
					const isDeleting = isMarkedForDeletion(item.id);

					return (
						<View
							key={item.id}
							style={[
								styles.thumbnailContainer,
								{ width: thumbnailSize, height: thumbnailSize },
								isDeleting && styles.deletedItem,
							]}
						>
							<Image
								source={{
									uri:
										item.type.includes("video") &&
										item.thumbnailUri
											? item.thumbnailUri
											: item.uri,
								}}
								style={styles.mediaThumbnail}
							/>

							{item.type.includes("video") && (
								<View style={styles.videoIndicator}>
									<Ionicons
										name="play-circle"
										size={22}
										color="#fff"
									/>
								</View>
							)}

							{renderProgressOverlay(item.id)}

							<TouchableOpacity
								style={[
									styles.actionButton,
									isDeleting
										? styles.restoreButton
										: styles.deleteButton,
								]}
								onPress={() =>
									isDeleting
										? onRestore(item.id)
										: onDelete(
												item.id,
												true,
												item.isExisting,
											)
								}
								disabled={!!uploadProgress[item.id]}
							>
								<Ionicons
									name={
										isDeleting
											? "reload-outline"
											: "close-circle"
									}
									size={22}
									color={isDeleting ? "#3d7eea" : "#e74c3c"}
								/>
							</TouchableOpacity>

							<Text
								numberOfLines={1}
								style={styles.thumbnailName}
							>
								{item.name}
							</Text>
						</View>
					);
				})}

				{/* File thumbnails */}
				{files.map((item) => {
					const isDeleting = isMarkedForDeletion(item.id);

					return (
						<View
							key={item.id}
							style={[
								styles.thumbnailContainer,
								{ width: thumbnailSize, height: thumbnailSize },
								isDeleting && styles.deletedItem,
							]}
						>
							<View style={styles.fileThumbnail}>
								<Ionicons
									name={getFileIcon(item.type)}
									size={40}
									color="#3d7eea"
								/>
							</View>

							{renderProgressOverlay(item.id)}

							<TouchableOpacity
								style={[
									styles.actionButton,
									isDeleting
										? styles.restoreButton
										: styles.deleteButton,
								]}
								onPress={() =>
									isDeleting
										? onRestore(item.id)
										: onDelete(
												item.id,
												false,
												item.isExisting,
											)
								}
								disabled={!!uploadProgress[item.id]}
							>
								<Ionicons
									name={
										isDeleting
											? "reload-outline"
											: "close-circle"
									}
									size={22}
									color={isDeleting ? "#3d7eea" : "#e74c3c"}
								/>
							</TouchableOpacity>

							<Text
								numberOfLines={1}
								style={styles.thumbnailName}
							>
								{item.name}
							</Text>
						</View>
					);
				})}
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		marginTop: 8,
	},
	galleryTitle: {
		fontSize: 15,
		marginBottom: 10,
		color: "#555",
		fontWeight: "500",
	},
	galleryContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
	},
	thumbnailContainer: {
		borderRadius: 8,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: "#e0e0e0",
		backgroundColor: "#f8f9fa",
		position: "relative",
	},
	mediaThumbnail: {
		width: "100%",
		height: "80%",
		backgroundColor: "#f0f0f0",
	},
	fileThumbnail: {
		width: "100%",
		height: "80%",
		backgroundColor: "#f0f6ff",
		justifyContent: "center",
		alignItems: "center",
	},
	thumbnailName: {
		fontSize: 12,
		color: "#555",
		padding: 4,
		textAlign: "center",
	},
	actionButton: {
		position: "absolute",
		top: 4,
		right: 4,
		backgroundColor: "rgba(255, 255, 255, 0.8)",
		borderRadius: 12,
		padding: 2,
		zIndex: 10,
	},
	deleteButton: {
		backgroundColor: "rgba(255, 255, 255, 0.8)",
	},
	restoreButton: {
		backgroundColor: "rgba(255, 255, 255, 0.8)",
	},
	videoIndicator: {
		position: "absolute",
		top: "30%",
		left: "40%",
		backgroundColor: "rgba(0, 0, 0, 0.3)",
		borderRadius: 20,
		padding: 3,
	},
	deletedItem: {
		opacity: 0.5,
	},
	progressOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: "80%",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	progressBarContainer: {
		width: "80%",
		height: 8,
		backgroundColor: "rgba(255, 255, 255, 0.3)",
		borderRadius: 4,
		overflow: "hidden",
	},
	progressBar: {
		height: "100%",
		backgroundColor: "#3d7eea",
	},
	progressText: {
		color: "#fff",
		marginTop: 5,
		fontSize: 12,
		fontWeight: "bold",
	},
	errorText: {
		color: "#fff",
		marginTop: 5,
		fontSize: 12,
		fontWeight: "bold",
	},
});

export default ThumbnailGallery;
