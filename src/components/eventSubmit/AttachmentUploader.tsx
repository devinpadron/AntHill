import React from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ImageBackground,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FileUpload } from "../../types";
import { pickDocuments, pickImages } from "../../utils/fileUtils";

type AttachmentUploaderProps = {
	files: FileUpload[];
	onFilesAdded: (files: FileUpload[]) => void;
	onFileDelete: (file: FileUpload) => void;
	onFileUndelete: (file: FileUpload) => void;
	deletionQueue: string[];
};

export const AttachmentUploader = ({
	files,
	onFilesAdded,
	onFileDelete,
	onFileUndelete,
	deletionQueue,
}: AttachmentUploaderProps) => {
	const handleDocumentUpload = async () => {
		const documents = await pickDocuments();
		if (documents.length > 0) {
			onFilesAdded(documents);
		}
	};

	const handleImageUpload = async () => {
		const images = await pickImages();
		if (images.length > 0) {
			onFilesAdded(images);
		}
	};

	const imageFiles = files.filter((file) => file.type.startsWith("image/"));
	const documentFiles = files.filter(
		(file) => !file.type.startsWith("image/"),
	);

	return (
		<View style={styles.inputContainer}>
			<View style={styles.uploadButtonsContainer}>
				<TouchableOpacity
					style={styles.uploadButton}
					onPress={handleDocumentUpload}
				>
					<Ionicons name="document-outline" size={24} color="#555" />
					<Text style={styles.uploadButtonText}>Upload Files</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.uploadButton}
					onPress={handleImageUpload}
				>
					<Ionicons name="image-outline" size={24} color="#555" />
					<Text style={styles.uploadButtonText}>Choose Images</Text>
				</TouchableOpacity>
			</View>

			{files.length > 0 && (
				<View style={styles.filesContainer}>
					{/* Image Grid */}
					{imageFiles.length > 0 && (
						<View style={styles.imageGrid}>
							{imageFiles.map((file, index) => (
								<View
									key={`img-${index}`}
									style={styles.thumbnailContainer}
								>
									<ImageBackground
										source={{ uri: file.url || file.uri }}
										style={styles.thumbnail}
									>
										{file.id &&
										deletionQueue.includes(file.id) ? (
											<View
												style={
													styles.thumbnailDeleteOverlay
												}
											>
												<TouchableOpacity
													onPress={() =>
														onFileUndelete(file)
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
												style={styles.fileDeleteButton}
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
									</ImageBackground>
								</View>
							))}
						</View>
					)}

					{/* Document List */}
					{documentFiles.length > 0 && (
						<View style={styles.documentList}>
							{documentFiles.map((file, index) => (
								<View
									key={`doc-${index}`}
									style={styles.documentItem}
								>
									<Ionicons
										name="document-outline"
										size={24}
										color="#555"
										style={styles.documentIcon}
									/>
									<Text
										numberOfLines={1}
										style={styles.documentFilename}
									>
										{file.name}
									</Text>

									{file.id &&
									deletionQueue.includes(file.id) ? (
										<TouchableOpacity
											onPress={() => onFileUndelete(file)}
											style={styles.documentDeleteButton}
										>
											<Ionicons
												name="arrow-undo-circle"
												size={24}
												color="red"
											/>
										</TouchableOpacity>
									) : (
										<TouchableOpacity
											onPress={() => onFileDelete(file)}
											style={styles.documentDeleteButton}
										>
											<Ionicons
												name="close-circle"
												size={24}
												color="red"
											/>
										</TouchableOpacity>
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
});
