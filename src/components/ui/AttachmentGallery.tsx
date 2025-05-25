import React, { useState, useEffect, useRef, useCallback } from "react";
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	StyleSheet,
	Dimensions,
	Modal,
	SafeAreaView,
	ActivityIndicator,
	ViewStyle,
	TextStyle,
	ImageStyle,
	FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useVideoPlayer, VideoView } from "expo-video";
import { AttachmentItem } from "../../types";
import { useEvent } from "expo";
import WebView from "react-native-webview";
import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import { PanGestureHandler, State } from "react-native-gesture-handler";

interface AttachmentGalleryProps {
	attachments: AttachmentItem[];
}

const AttachmentGallery: React.FC<AttachmentGalleryProps> = ({
	attachments,
}) => {
	const [modalVisible, setModalVisible] = useState(false);
	const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
	const [savingMedia, setSavingMedia] = useState(false);
	const [sharingMedia, setSharingMedia] = useState(false);
	const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
	const [documentViewerVisible, setDocumentViewerVisible] = useState(false);
	const [selectedDocument, setSelectedDocument] =
		useState<AttachmentItem | null>(null);
	const [documentLoading, setDocumentLoading] = useState(true);
	const windowWidth = Dimensions.get("window").width;
	const itemWidth = (windowWidth - 80) / 3;

	// Initialize video player outside of render function
	const videoPlayer = useVideoPlayer(currentVideoUrl || "", (player) => {
		if (currentVideoUrl) {
			player.play();
		}
	});

	const { isPlaying } = useEvent(videoPlayer, "playingChange", {
		isPlaying: videoPlayer.playing,
	});

	// Separate attachments into media and documents
	const mediaAttachments = attachments.filter(
		(item) =>
			item.type.startsWith("image/") || item.type.startsWith("video/"),
	);

	const documentAttachments = attachments.filter(
		(item) =>
			!item.type.startsWith("image/") && !item.type.startsWith("video/"),
	);

	// Update video URL when selected media changes
	useEffect(() => {
		if (modalVisible && mediaAttachments.length > 0) {
			const selectedMedia = mediaAttachments[selectedMediaIndex];
			if (selectedMedia.type.startsWith("video/")) {
				setCurrentVideoUrl(
					selectedMedia.downloadUrl || selectedMedia.uri,
				);
			} else {
				// Stop video if switching to an image
				setCurrentVideoUrl(null);
				if (videoPlayer) {
					videoPlayer.pause();
				}
			}
		} else {
			// Stop video when modal closes
			setCurrentVideoUrl(null);
			if (videoPlayer) {
				videoPlayer.pause();
			}
		}
	}, [modalVisible, selectedMediaIndex, mediaAttachments]);

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

	// Helper to get file color based on mime type
	const getFileColor = (mimeType: string) => {
		if (mimeType.includes("pdf")) return "#E74C3C";
		if (mimeType.includes("word") || mimeType.includes("msword"))
			return "#3498DB";
		if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
			return "#2ECC71";
		if (
			mimeType.includes("presentation") ||
			mimeType.includes("powerpoint")
		)
			return "#F39C12";
		return "#95A5A6";
	};

	// Save media to device
	const saveMedia = async (mediaItem: AttachmentItem) => {
		try {
			setSavingMedia(true);

			// Request permissions
			const { status } = await MediaLibrary.requestPermissionsAsync();
			if (status !== "granted") {
				alert(
					"Sorry, we need media library permissions to save media.",
				);
				setSavingMedia(false);
				return;
			}

			// Download the file if it's a remote URL
			let localUri = mediaItem.downloadUrl || mediaItem.uri;
			if (localUri.startsWith("http")) {
				const fileExt = mediaItem.type.split("/")[1];
				const downloadResult = await FileSystem.downloadAsync(
					localUri,
					FileSystem.documentDirectory + `${mediaItem.id}.${fileExt}`,
				);
				localUri = downloadResult.uri;
			}

			// Save to media library
			const asset = await MediaLibrary.createAssetAsync(localUri);
			await MediaLibrary.createAlbumAsync("AntHill", asset, false);

			alert("Media saved successfully!");
		} catch (error) {
			console.error("Error saving media:", error);
			alert("Failed to save media");
		} finally {
			setSavingMedia(false);
		}
	};

	// Share media
	const shareMedia = async (mediaItem: AttachmentItem) => {
		try {
			setSharingMedia(true);

			// Check if sharing is available
			if (!(await Sharing.isAvailableAsync())) {
				alert("Sharing is not available on this device");
				setSharingMedia(false);
				return;
			}

			// Download the file if it's a remote URL
			let localUri = mediaItem.downloadUrl || mediaItem.uri;
			if (localUri.startsWith("http")) {
				const fileExt = mediaItem.type.split("/")[1];
				const downloadResult = await FileSystem.downloadAsync(
					localUri,
					FileSystem.documentDirectory + `${mediaItem.id}.${fileExt}`,
				);
				localUri = downloadResult.uri;
			}

			// Share the file
			await Sharing.shareAsync(localUri, {
				mimeType: mediaItem.type,
				dialogTitle: "Share " + mediaItem.name,
			});
		} catch (error) {
			console.error("Error sharing media:", error);
			alert("Failed to share media");
		} finally {
			setSharingMedia(false);
		}
	};

	// Handle document tap
	const handleDocumentTap = (document: AttachmentItem) => {
		setSelectedDocument(document);
		setDocumentLoading(true);
		setDocumentViewerVisible(true);
	};

	// Open media in carousel
	const openMediaCarousel = (index: number) => {
		setSelectedMediaIndex(index);
		setModalVisible(true);
	};

	// Navigate through carousel
	const navigateCarousel = (direction: "prev" | "next") => {
		let newIndex;
		if (direction === "prev") {
			newIndex =
				selectedMediaIndex === 0
					? mediaAttachments.length - 1
					: selectedMediaIndex - 1;
		} else {
			newIndex =
				selectedMediaIndex === mediaAttachments.length - 1
					? 0
					: selectedMediaIndex + 1;
		}
		setSelectedMediaIndex(newIndex);
	};

	// Render a document item
	const renderDocumentItem = (item: AttachmentItem, index: number) => (
		<TouchableOpacity
			key={item.id}
			style={[
				styles.itemContainer,
				{ width: itemWidth, height: itemWidth * 1.25 },
			]}
			onPress={() => handleDocumentTap(item)}
		>
			<View
				style={[
					styles.documentPreview,
					{ backgroundColor: `${getFileColor(item.type)}20` },
				]}
			>
				<Ionicons
					name={getFileIcon(item.type)}
					size={40}
					color={getFileColor(item.type)}
				/>
			</View>
			<View style={styles.itemDetails}>
				<Text style={styles.itemName} numberOfLines={2}>
					{item.name}
				</Text>
				<Text style={styles.itemSize}>{formatFileSize(item.size)}</Text>
			</View>
		</TouchableOpacity>
	);

	// Render a media item (image or video)
	const renderMediaItem = (item: AttachmentItem, index: number) => (
		<TouchableOpacity
			key={item.id}
			style={[
				styles.itemContainer,
				{ width: itemWidth, height: itemWidth },
			]}
			onPress={() => openMediaCarousel(index)}
		>
			<Image
				source={{
					uri:
						item.type.startsWith("video/") && item.thumbnailUrl
							? item.thumbnailUrl
							: item.downloadUrl || item.uri,
				}}
				style={styles.mediaPreview}
				resizeMode="cover"
			/>
			{item.type.startsWith("video/") && (
				<View style={styles.videoIndicator}>
					<Ionicons name="play-circle" size={28} color="#FFFFFF" />
				</View>
			)}
		</TouchableOpacity>
	);

	// Render the media carousel modal
	const renderMediaCarousel = () => {
		if (mediaAttachments.length === 0) return null;

		// Create a ref for the FlatList to programmatically scroll when needed
		const flatListRef = useRef<FlatList>(null);

		const handleViewableItemsChanged = useRef(({ viewableItems }) => {
			if (viewableItems.length > 0) {
				const newIndex = viewableItems[0].index;
				if (newIndex !== selectedMediaIndex) {
					setSelectedMediaIndex(newIndex);
				}
			}
		}).current;

		const viewabilityConfig = {
			itemVisiblePercentThreshold: 50,
		};

		// Render a single carousel item
		const renderCarouselItem = ({ item, index }) => {
			const isVideo = item.type.startsWith("video/");

			// Only show the video player for the current item to prevent performance issues
			const shouldRenderVideo = isVideo && index === selectedMediaIndex;

			return (
				<View style={styles.carouselItemContainer}>
					{shouldRenderVideo ? (
						<View style={styles.videoContainer}>
							<VideoView
								player={videoPlayer}
								style={styles.videoPlayer}
								allowsFullscreen={true}
							/>
						</View>
					) : isVideo ? (
						// Show thumbnail for videos not in view
						<View style={styles.videoContainer}>
							<Image
								source={{
									uri:
										item.thumbnailUrl ||
										item.downloadUrl ||
										item.uri,
								}}
								style={styles.videoThumbnail}
								resizeMode="contain"
							/>
							<View style={styles.playButtonOverlay}>
								<Ionicons
									name="play-circle"
									size={50}
									color="white"
								/>
							</View>
						</View>
					) : (
						// Show image
						<ImageZoom
							uri={item.downloadUrl || item.uri}
							style={styles.fullImage}
							isDoubleTapEnabled={true}
						/>
					)}
				</View>
			);
		};

		const [pullDistance, setPullDistance] = useState(0);
		const [isPullingDown, setIsPullingDown] = useState(false);

		const handleGestureStateChange = useCallback(
			(event) => {
				if (event.nativeEvent.oldState === State.ACTIVE) {
					if (isPullingDown && pullDistance > 150) {
						setModalVisible(false);
					}
					setPullDistance(0);
					setIsPullingDown(false);
				}
			},
			[isPullingDown, pullDistance],
		);

		const handleGestureEvent = useCallback((event) => {
			const { translationY, translationX } = event.nativeEvent;

			// Only handle downward gestures that are more vertical than horizontal
			if (
				translationY > 0 &&
				translationY > Math.abs(translationX) * 1.5
			) {
				setIsPullingDown(true);
				// Apply some resistance to the pull (square root creates a nice resistance effect)
				setPullDistance(Math.sqrt(translationY) * 10);
			}
		}, []);

		// Reset values when modal opens or closes
		useEffect(() => {
			if (modalVisible) {
				setPullDistance(0);
				setIsPullingDown(false);
			}
		}, [modalVisible]);

		// Effect to scroll the FlatList when selectedMediaIndex changes
		// outside of user scrolling (like when using the prev/next buttons)
		useEffect(() => {
			if (flatListRef.current && modalVisible) {
				flatListRef.current.scrollToIndex({
					index: selectedMediaIndex,
					animated: true,
					viewPosition: 0.5,
				});
			}
		}, [selectedMediaIndex, modalVisible]);

		return (
			<Modal
				visible={modalVisible}
				transparent={false}
				animationType="fade"
				onRequestClose={() => setModalVisible(false)}
			>
				<SafeAreaView style={styles.carouselContainer}>
					<View style={styles.carouselHeader}>
						<TouchableOpacity
							onPress={() => setModalVisible(false)}
							style={styles.closeButton}
						>
							<Ionicons name="close" size={28} color="#FFFFFF" />
						</TouchableOpacity>
						<Text style={styles.carouselTitle} numberOfLines={1}>
							{mediaAttachments[selectedMediaIndex]?.name}
						</Text>
						<View style={styles.carouselActions}>
							<TouchableOpacity
								onPress={() =>
									saveMedia(
										mediaAttachments[selectedMediaIndex],
									)
								}
								style={styles.actionButton}
								disabled={savingMedia}
							>
								{savingMedia ? (
									<ActivityIndicator
										size="small"
										color="#FFFFFF"
									/>
								) : (
									<Ionicons
										name="download-outline"
										size={24}
										color="#FFFFFF"
									/>
								)}
							</TouchableOpacity>
							<TouchableOpacity
								onPress={() =>
									shareMedia(
										mediaAttachments[selectedMediaIndex],
									)
								}
								style={styles.actionButton}
								disabled={sharingMedia}
							>
								{sharingMedia ? (
									<ActivityIndicator
										size="small"
										color="#FFFFFF"
									/>
								) : (
									<Ionicons
										name="share-outline"
										size={24}
										color="#FFFFFF"
									/>
								)}
							</TouchableOpacity>
						</View>
					</View>

					{/* Swipeable Carousel */}
					<View style={styles.carouselContent}>
						<PanGestureHandler
							onHandlerStateChange={handleGestureStateChange}
							onGestureEvent={handleGestureEvent}
						>
							<View
								style={{
									flex: 1,
									width: "100%",
									transform: [
										{ translateY: pullDistance },
										{
											scale: Math.max(
												0.8,
												1 - pullDistance / 1000,
											),
										},
									],
									opacity: Math.max(
										0.5,
										1 - pullDistance / 500,
									),
								}}
							>
								<FlatList
									ref={flatListRef}
									data={mediaAttachments}
									renderItem={renderCarouselItem}
									keyExtractor={(item) => item.id}
									horizontal
									pagingEnabled
									showsHorizontalScrollIndicator={false}
									initialScrollIndex={selectedMediaIndex}
									getItemLayout={(data, index) => ({
										length: Dimensions.get("window").width,
										offset:
											Dimensions.get("window").width *
											index,
										index,
									})}
									onViewableItemsChanged={
										handleViewableItemsChanged
									}
									viewabilityConfig={viewabilityConfig}
									onScrollToIndexFailed={(info) => {
										// Handle scroll failure - happens if trying to scroll to an index
										// that doesn't exist or is far from the current position
										setTimeout(() => {
											if (flatListRef.current) {
												flatListRef.current.scrollToIndex(
													{
														index: info.index,
														animated: false,
													},
												);
											}
										}, 100);
									}}
								/>
							</View>
						</PanGestureHandler>
					</View>

					<View style={styles.carouselNavigation}>
						<TouchableOpacity
							onPress={() => navigateCarousel("prev")}
							style={styles.navButton}
						>
							<Ionicons
								name="chevron-back"
								size={30}
								color="#FFFFFF"
							/>
						</TouchableOpacity>
						<Text style={styles.pageIndicator}>
							{selectedMediaIndex + 1} / {mediaAttachments.length}
						</Text>
						<TouchableOpacity
							onPress={() => navigateCarousel("next")}
							style={styles.navButton}
						>
							<Ionicons
								name="chevron-forward"
								size={30}
								color="#FFFFFF"
							/>
						</TouchableOpacity>
					</View>
				</SafeAreaView>
			</Modal>
		);
	};

	// Render the document viewer modal
	const renderDocumentViewer = () => {
		if (!selectedDocument) return null;

		const documentUrl =
			selectedDocument.downloadUrl || selectedDocument.uri;

		return (
			<Modal
				visible={documentViewerVisible}
				transparent={false}
				animationType="slide"
				onRequestClose={() => setDocumentViewerVisible(false)}
			>
				<SafeAreaView style={styles.documentViewerContainer}>
					<View style={styles.documentViewerHeader}>
						<TouchableOpacity
							onPress={() => setDocumentViewerVisible(false)}
							style={styles.closeButton}
						>
							<Ionicons name="close" size={28} color="#333" />
						</TouchableOpacity>
						<Text
							style={styles.documentViewerTitle}
							numberOfLines={1}
						>
							{selectedDocument.name}
						</Text>
						<TouchableOpacity
							onPress={() => shareMedia(selectedDocument)}
							style={styles.actionButton}
							disabled={sharingMedia}
						>
							{sharingMedia ? (
								<ActivityIndicator
									size="small"
									color="#3d7eea"
								/>
							) : (
								<Ionicons
									name="share-outline"
									size={24}
									color="#3d7eea"
								/>
							)}
						</TouchableOpacity>
					</View>

					<View style={styles.documentViewerContent}>
						{documentLoading && (
							<View style={styles.documentLoadingContainer}>
								<ActivityIndicator
									size="large"
									color="#3d7eea"
								/>
								<Text style={styles.documentLoadingText}>
									Loading document...
								</Text>
							</View>
						)}

						<WebView
							source={{ uri: documentUrl }}
							style={styles.webView}
							onLoadStart={() => setDocumentLoading(true)}
							onLoad={() => setDocumentLoading(false)}
							onError={() => {
								setDocumentLoading(false);
								alert(
									"Failed to load document. The file format may not be supported.",
								);
							}}
							startInLoadingState={true}
							renderLoading={() => null} // We'll use our own loader
							allowFileAccess={true}
							allowUniversalAccessFromFileURLs={true}
							allowFileAccessFromFileURLs={true}
							originWhitelist={["*"]}
							javaScriptEnabled={true}
							domStorageEnabled={true}
						/>
					</View>
				</SafeAreaView>
			</Modal>
		);
	};

	// Format file size to readable format
	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
	};

	// If no attachments, show nothing
	if (attachments.length === 0) {
		return null;
	}

	return (
		<View style={styles.container}>
			{/* Media Section */}
			{mediaAttachments.length > 0 && (
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Photos & Videos</Text>
					<View style={styles.gridContainer}>
						{mediaAttachments.map((item, index) =>
							renderMediaItem(item, index),
						)}
					</View>
				</View>
			)}

			{/* Documents Section */}
			{documentAttachments.length > 0 && (
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Documents</Text>
					<View style={styles.gridContainer}>
						{documentAttachments.map((item, index) =>
							renderDocumentItem(item, index),
						)}
					</View>
				</View>
			)}

			{/* Media Carousel Modal */}
			{renderMediaCarousel()}

			{/* Document Viewer Modal */}
			{renderDocumentViewer()}
		</View>
	);
};

// Define style interface to fix typing issues
interface Styles {
	container: ViewStyle;
	section: ViewStyle;
	sectionTitle: TextStyle;
	gridContainer: ViewStyle;
	itemContainer: ViewStyle;
	mediaPreview: ImageStyle;
	documentPreview: ViewStyle;
	videoIndicator: ViewStyle;
	itemDetails: ViewStyle;
	itemName: TextStyle;
	itemSize: TextStyle;
	carouselContainer: ViewStyle;
	carouselHeader: ViewStyle;
	closeButton: ViewStyle;
	carouselTitle: TextStyle;
	carouselActions: ViewStyle;
	actionButton: ViewStyle;
	carouselContent: ViewStyle;
	fullImage: ImageStyle;
	videoPlayer: ViewStyle;
	carouselNavigation: ViewStyle;
	navButton: ViewStyle;
	pageIndicator: TextStyle;
	videoContainer: ViewStyle;
	thumbnailOverlay: ViewStyle;
	videoThumbnail: ImageStyle;
	playButtonOverlay: ViewStyle;
	documentViewerContainer: ViewStyle;
	documentViewerHeader: ViewStyle;
	documentViewerTitle: TextStyle;
	documentViewerContent: ViewStyle;
	webView: ViewStyle;
	documentLoadingContainer: ViewStyle;
	documentLoadingText: TextStyle;
	carouselItemContainer: ViewStyle; // Add this line
}

const styles = StyleSheet.create<Styles>({
	container: {
		marginVertical: 10,
	},
	section: {
		marginBottom: 16,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "600",
		marginBottom: 8,
		color: "#333",
		paddingHorizontal: 8,
	},
	gridContainer: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		paddingHorizontal: 4,
	},
	itemContainer: {
		margin: 4,
		borderRadius: 8,
		overflow: "hidden",
		backgroundColor: "#FFFFFF",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 2,
		elevation: 2,
	},
	mediaPreview: {
		width: "100%",
		height: "100%",
		backgroundColor: "#F5F5F5",
	},
	documentPreview: {
		width: "100%",
		height: "70%",
		justifyContent: "center",
		alignItems: "center",
	},
	videoIndicator: {
		position: "absolute",
		top: "35%",
		left: "50%",
		transform: [{ translateX: -14 }, { translateY: -14 }],
		backgroundColor: "rgba(0, 0, 0, 0.3)",
		borderRadius: 20,
		padding: 3,
	},
	itemDetails: {
		padding: 6,
		height: "30%",
		justifyContent: "space-between",
	},
	itemName: {
		fontSize: 12,
		color: "#333",
		fontWeight: "500",
	},
	itemSize: {
		fontSize: 10,
		color: "#666",
	},
	carouselContainer: {
		flex: 1,
		backgroundColor: "#000000",
	},
	carouselHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "space-between",
	},
	closeButton: {
		padding: 4,
	},
	carouselTitle: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "500",
		flex: 1,
		marginHorizontal: 12,
	},
	carouselActions: {
		flexDirection: "row",
	},
	actionButton: {
		padding: 8,
		marginLeft: 12,
	},
	carouselContent: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	fullImage: {
		width: "100%",
		height: "100%",
	},
	videoPlayer: {
		width: "100%",
		height: "100%",
	},
	carouselNavigation: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 16,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
	},
	navButton: {
		padding: 8,
	},
	pageIndicator: {
		color: "#FFFFFF",
		fontSize: 14,
	},
	videoContainer: {
		position: "relative",
		width: "100%",
		height: "100%",
	},
	thumbnailOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: 10,
	},
	videoThumbnail: {
		width: "100%",
		height: "100%",
		backgroundColor: "#000",
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
	documentViewerContainer: {
		flex: 1,
		backgroundColor: "#FFFFFF",
	},
	documentViewerHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#F8F8F8",
		borderBottomWidth: 1,
		borderBottomColor: "#E0E0E0",
		justifyContent: "space-between",
	},
	documentViewerTitle: {
		color: "#333333",
		fontSize: 16,
		fontWeight: "500",
		flex: 1,
		marginHorizontal: 12,
	},
	documentViewerContent: {
		flex: 1,
		position: "relative",
	},
	webView: {
		flex: 1,
		backgroundColor: "#F8F8F8",
	},
	documentLoadingContainer: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#FFFFFF",
		zIndex: 10,
	},
	documentLoadingText: {
		marginTop: 12,
		fontSize: 14,
		color: "#555555",
	},
	carouselItemContainer: {
		width: Dimensions.get("window").width,
		height: "100%",
		justifyContent: "center",
		alignItems: "center",
	}, // Add this line
});

export default AttachmentGallery;
