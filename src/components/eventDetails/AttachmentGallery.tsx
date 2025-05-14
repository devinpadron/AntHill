import React, { useState, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	Dimensions,
	ImageBackground,
	TouchableOpacity,
	Linking,
	Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ImageView from "react-native-image-viewing";
import { VideoView, useVideoPlayer } from "expo-video";
import { FileUpload } from "../../types";

type AttachmentGalleryProps = {
	attachments: FileUpload[];
};

export const AttachmentGallery = ({ attachments }: AttachmentGalleryProps) => {
	const [visible, setIsVisible] = useState(false);
	const [imageIndex, setImageIndex] = useState(0);
	const [videoModalVisible, setVideoModalVisible] = useState(false);
	const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
	const videoRef = useRef(null);
	const player = useVideoPlayer(selectedVideo, (player) => {
		player.play();
	});

	// Separate files by type
	const imageFiles = attachments.filter((file) =>
		file.type.startsWith("image/"),
	);
	const videoFiles = attachments.filter((file) =>
		file.type.startsWith("video/"),
	);
	const documentFiles = attachments.filter(
		(file) =>
			!file.type.startsWith("image/") && !file.type.startsWith("video/"),
	);

	const images = imageFiles.map((file) => ({ uri: file.url }));

	if (attachments.length === 0) {
		return null;
	}

	const handleVideoPress = (videoUrl) => {
		setSelectedVideo(videoUrl);
		setVideoModalVisible(true);
	};

	return (
		<View style={styles.filesContainer}>
			{/* Image Gallery */}
			{imageFiles.length > 0 && (
				<>
					<Text style={styles.sectionTitle}>Images</Text>
					<ImageView
						images={images}
						imageIndex={imageIndex}
						visible={visible}
						onRequestClose={() => setIsVisible(false)}
					/>
					<View style={styles.imageGrid}>
						{imageFiles.map((file, index) => (
							<View
								key={`img-${index}`}
								style={styles.thumbnailContainer}
							>
								<TouchableOpacity
									onPress={() => {
										setImageIndex(index);
										setIsVisible(true);
									}}
								>
									<ImageBackground
										style={styles.thumbnail}
										source={{ uri: file.url }}
										resizeMode="cover"
									/>
								</TouchableOpacity>
							</View>
						))}
					</View>
				</>
			)}

			{/* Video Gallery */}
			{videoFiles.length > 0 && (
				<>
					<Text style={styles.sectionTitle}>Videos</Text>
					<View style={styles.videoGrid}>
						{videoFiles.map((file, index) => (
							<View
								key={`vid-${index}`}
								style={styles.videoThumbnailContainer}
							>
								<TouchableOpacity
									onPress={() => handleVideoPress(file.url)}
								>
									{file.thumbnailUrl ? (
										<ImageBackground
											style={styles.videoThumbnail}
											source={{ uri: file.thumbnailUrl }}
											resizeMode="cover"
										>
											<View
												style={styles.playButtonOverlay}
											>
												<Ionicons
													name="play-circle"
													size={40}
													color="#fff"
												/>
											</View>
										</ImageBackground>
									) : (
										<View
											style={
												styles.videoThumbnailPlaceholder
											}
										>
											<Ionicons
												name="videocam"
												size={36}
												color="#555"
											/>
											<Text
												numberOfLines={1}
												style={styles.videoName}
											>
												{file.name}
											</Text>
											<View
												style={styles.playButtonOverlay}
											>
												<Ionicons
													name="play-circle"
													size={40}
													color="#fff"
												/>
											</View>
										</View>
									)}
								</TouchableOpacity>
							</View>
						))}
					</View>
				</>
			)}

			{/* Document List */}
			{documentFiles.length > 0 && (
				<>
					<Text style={styles.sectionTitle}>Documents</Text>
					<View style={styles.documentList}>
						{documentFiles.map((file, index) => (
							<TouchableOpacity
								key={`doc-${index}`}
								onPress={() => Linking.openURL(file.url)}
							>
								<View style={styles.documentItem}>
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
								</View>
							</TouchableOpacity>
						))}
					</View>
				</>
			)}

			{/* Video Playback Modal */}
			<Modal
				visible={videoModalVisible}
				transparent={true}
				animationType="slide"
				onRequestClose={() => {
					setVideoModalVisible(false);
					if (player) {
						player.pause();
					}
				}}
				onShow={() => {
					if (player) {
						player.play();
					}
				}}
			>
				<View style={styles.videoModalContainer}>
					<TouchableOpacity
						style={styles.closeButton}
						onPress={() => {
							setVideoModalVisible(false);
							// Make sure to pause the video when closing
							if (player) {
								player.pause();
							}
						}}
					>
						<Ionicons name="close-circle" size={36} color="white" />
					</TouchableOpacity>

					{selectedVideo && (
						<VideoView
							ref={videoRef}
							player={player}
							style={styles.videoPlayer}
							contentFit="contain"
						/>
					)}
				</View>
			</Modal>
		</View>
	);
};

const styles = StyleSheet.create({
	filesContainer: {
		marginTop: 16,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "600",
		marginBottom: 12,
		marginTop: 16,
		color: "#555",
	},
	imageGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
		marginBottom: 10,
	},
	videoGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
		marginBottom: 10,
	},
	thumbnailContainer: {
		width: "30%", // 3 columns with padding
		aspectRatio: 1,
		borderRadius: 8,
		backgroundColor: "#f5f5f5",
		position: "relative",
		overflow: "visible",
	},
	videoThumbnailContainer: {
		width: "48%", // 2 columns with padding
		aspectRatio: 16 / 9,
		borderRadius: 8,
		backgroundColor: "#f5f5f5",
		marginBottom: 10,
		overflow: "hidden",
	},
	thumbnail: {
		width: (Dimensions.get("window").width - 60) / 3,
		height: "100%",
		borderRadius: 8,
		zIndex: 1,
	},
	videoThumbnail: {
		width: "100%",
		height: "100%",
		justifyContent: "center",
		alignItems: "center",
	},
	videoThumbnailPlaceholder: {
		width: "100%",
		height: "100%",
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#e0e0e0",
		borderRadius: 8,
	},
	playButtonOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "rgba(0,0,0,0.3)",
	},
	videoName: {
		fontSize: 12,
		color: "#555",
		marginTop: 4,
		textAlign: "center",
		paddingHorizontal: 5,
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
	videoModalContainer: {
		flex: 1,
		backgroundColor: "black",
		justifyContent: "center",
	},
	videoPlayer: {
		width: "100%",
		height: 300,
		alignSelf: "center",
	},
	closeButton: {
		position: "absolute",
		top: 40,
		right: 20,
		zIndex: 10,
	},
});
