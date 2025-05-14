import React from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ImageBackground,
	ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FileUpload } from "../../types";
import { pickDocuments, pickMedia } from "../../utils/fileUtils";

type AttachmentUploaderProps = {
	files: FileUpload[];
	onFilesAdded: (files: FileUpload[]) => void;
	onFileDelete: (file: FileUpload) => void;
	onFileUndelete: (file: FileUpload) => void;
	deletionQueue: string[];
	uploadingFiles?: string[];
	uploadProgress?: Record<string, number>;
	docOnly?: boolean; // Add this prop
	mediaOnly?: boolean; // Add this prop
};

export const AttachmentUploader = ({
	files,
	onFilesAdded,
	onFileDelete,
	onFileUndelete,
	deletionQueue,
	uploadingFiles = [],
	uploadProgress = {},
	docOnly = false, // Add default value
	mediaOnly = false, // Add default value
}: AttachmentUploaderProps) => {
	const [isLoading, setIsLoading] = React.useState(false);

	const handleDocumentUpload = async () => {
		setIsLoading(true);
		const documents = await pickDocuments();
		setIsLoading(false);
		if (documents.length > 0) {
			onFilesAdded(documents);
		}
	};

	const handleImageUpload = async () => {
		setIsLoading(true);
		const media = await pickMedia();
		setIsLoading(false);
		if (media.length > 0) {
			onFilesAdded(media);
		}
	};

	const imageFiles = files.filter((file) => file.type.startsWith("image/"));
	const videoFiles = files.filter((file) => file.type.startsWith("video/"));
	const mediaFiles = [...imageFiles, ...videoFiles];
	const documentFiles = files.filter(
		(file) =>
			!file.type.startsWith("image/") && !file.type.startsWith("video/"),
	);

	const isVideo = (file: FileUpload) => file.type.startsWith("video/");
	const isUploading = (file: FileUpload) => uploadingFiles.includes(file.uri);
	const getProgress = (file: FileUpload) => uploadProgress[file.uri] || 0;

	return (
		<View style={styles.inputContainer}>
			<View style={styles.uploadButtonsContainer}>
				{!mediaOnly && (
					<TouchableOpacity
						style={styles.uploadButton}
						onPress={handleDocumentUpload}
					>
						<Ionicons
							name="document-outline"
							size={24}
							color="#555"
						/>
						<Text style={styles.uploadButtonText}>
							Upload Files
						</Text>
					</TouchableOpacity>
				)}

				{!docOnly && (
					<TouchableOpacity
						style={styles.uploadButton}
						onPress={handleImageUpload}
					>
						<Ionicons name="image-outline" size={24} color="#555" />
						<Text style={styles.uploadButtonText}>
							Upload Media
						</Text>
					</TouchableOpacity>
				)}
			</View>

			{isLoading && (
				<View style={{ alignItems: "center", marginBottom: 10 }}>
					<Ionicons
						name="cloud-upload-outline"
						size={24}
						color="#555"
					/>
					<Text style={{ color: "#555" }}>
						Uploading files, please wait...
					</Text>
				</View>
			)}

			{files.length > 0 && (
				<View style={styles.filesContainer}>
					{mediaFiles.length > 0 && (
						<View style={styles.imageGrid}>
							{mediaFiles.map((file, index) => (
								<View
									key={`media-${index}`}
									style={styles.thumbnailContainer}
								>
									<ImageBackground
										source={{
											uri:
												file.thumbnailUrl ||
												file.url ||
												file.uri,
										}}
										style={styles.thumbnail}
									>
										{isUploading(file) && (
											<View
												style={styles.uploadingOverlay}
											>
												<ActivityIndicator
													size="small"
													color="#fff"
												/>
												<View
													style={
														styles.progressContainer
													}
												>
													<View
														style={[
															styles.progressBar,
															{
																width: `${getProgress(
																	file,
																)}%`,
															},
														]}
													/>
												</View>
												<Text
													style={styles.progressText}
												>
													{Math.round(
														getProgress(file),
													)}
													%
												</Text>
											</View>
										)}

										{isVideo(file) &&
											!isUploading(file) && (
												<View
													style={
														styles.videoIndicator
													}
												>
													<Ionicons
														name="play-circle"
														size={28}
														color="#fff"
													/>
												</View>
											)}

										{!isUploading(file) && (
											<>
												{file.id &&
												deletionQueue.includes(
													file.id,
												) ? (
													<View
														style={
															styles.thumbnailDeleteOverlay
														}
													>
														<TouchableOpacity
															onPress={() =>
																onFileUndelete(
																	file,
																)
															}
															style={
																styles.fileDeleteButton
															}
														>
															<View
																style={
																	styles.deleteButtonCircle
																}
															>
																<Ionicons
																	name="arrow-undo-circle"
																	size={24}
																	color="red"
																/>
															</View>
														</TouchableOpacity>
													</View>
												) : (
													<TouchableOpacity
														onPress={() =>
															onFileDelete(file)
														}
														style={
															styles.fileDeleteButton
														}
													>
														<View
															style={
																styles.deleteButtonCircle
															}
														>
															<Ionicons
																name="close-circle"
																size={24}
																color="red"
															/>
														</View>
													</TouchableOpacity>
												)}
											</>
										)}
									</ImageBackground>
								</View>
							))}
						</View>
					)}

					{documentFiles.length > 0 && (
						<View style={styles.documentList}>
							{documentFiles.map((file, index) => (
								<View
									key={`doc-${index}`}
									style={styles.documentItem}
								>
									{isUploading(file) ? (
										<ActivityIndicator
											size="small"
											color="#555"
											style={styles.documentIcon}
										/>
									) : (
										<Ionicons
											name="document-outline"
											size={24}
											color="#555"
											style={styles.documentIcon}
										/>
									)}

									<Text
										numberOfLines={1}
										style={styles.documentFilename}
									>
										{file.name}
										{isUploading(file) &&
											` (${Math.round(
												getProgress(file),
											)}%)`}
									</Text>

									{!isUploading(file) && (
										<>
											{file.id &&
											deletionQueue.includes(file.id) ? (
												<TouchableOpacity
													onPress={() =>
														onFileUndelete(file)
													}
													style={
														styles.documentDeleteButton
													}
												>
													<Ionicons
														name="arrow-undo-circle"
														size={24}
														color="red"
													/>
												</TouchableOpacity>
											) : (
												<TouchableOpacity
													onPress={() =>
														onFileDelete(file)
													}
													style={
														styles.documentDeleteButton
													}
												>
													<Ionicons
														name="close-circle"
														size={24}
														color="red"
													/>
												</TouchableOpacity>
											)}
										</>
									)}

									{isUploading(file) && (
										<View
											style={
												styles.docProgressBarContainer
											}
										>
											<View
												style={[
													styles.docProgressBar,
													{
														width: `${getProgress(
															file,
														)}%`,
													},
												]}
											/>
										</View>
									)}
								</View>
							))}
						</View>
					)}
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	inputContainer: {
		marginBottom: 20,
		zIndex: 1,
	},
	label: {
		fontSize: 16,
		marginBottom: 8,
		color: "#555",
		fontWeight: "600",
	},
	uploadButtonsContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 15,
	},
	uploadButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#fff",
		padding: 12,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#555",
		flex: 0.48,
		justifyContent: "center",
	},
	uploadButtonText: {
		color: "#555",
		fontSize: 16,
		marginLeft: 8,
	},
	filesContainer: {
		marginTop: 15,
	},
	imageGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
		marginBottom: 10,
	},
	thumbnailContainer: {
		width: "30%",
		aspectRatio: 1,
		borderRadius: 8,
		backgroundColor: "#f5f5f5",
		position: "relative",
		overflow: "visible",
	},
	thumbnail: {
		width: "100%",
		height: "100%",
		borderRadius: 8,
	},
	thumbnailDeleteOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		borderRadius: 8,
	},
	fileDeleteButton: {
		position: "absolute",
		top: -12,
		right: -12,
		width: 24,
		height: 24,
		zIndex: 2,
	},
	deleteButtonCircle: {
		backgroundColor: "white",
		borderRadius: 12,
		width: 24,
		height: 24,
		alignItems: "center",
		justifyContent: "center",
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 1,
	},
	documentList: {
		marginTop: 0,
	},
	documentItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f5f5f5",
		padding: 10,
		borderRadius: 8,
		marginBottom: 15,
	},
	documentIcon: {
		marginRight: 10,
	},
	documentFilename: {
		flex: 1,
		fontSize: 14,
	},
	documentDeleteButton: {
		padding: 5,
	},
	videoIndicator: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "rgba(0, 0, 0, 0.3)",
		borderRadius: 8,
	},
	uploadingOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
	},
	progressContainer: {
		width: "80%",
		height: 6,
		backgroundColor: "rgba(255, 255, 255, 0.3)",
		borderRadius: 3,
		marginTop: 8,
	},
	progressBar: {
		height: "100%",
		backgroundColor: "#4CAF50",
		borderRadius: 3,
	},
	progressText: {
		color: "white",
		fontSize: 12,
		marginTop: 4,
		fontWeight: "bold",
	},
	docProgressBarContainer: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		height: 3,
		backgroundColor: "#f0f0f0",
	},
	docProgressBar: {
		height: "100%",
		backgroundColor: "#007AFF",
	},
});
