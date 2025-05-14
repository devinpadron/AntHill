import React, { useState, useRef, useEffect } from "react";
import {
	View,
	Modal,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
	Dimensions,
	Image,
	Text,
	Platform,
	SafeAreaView,
	Animated,
	FlatList,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import {
	PinchGestureHandler,
	PanGestureHandler,
	State,
	GestureHandlerRootView,
} from "react-native-gesture-handler";

const { width, height } = Dimensions.get("window");

type MediaItem = {
	uri: string;
	type: string;
	name?: string;
	thumbnailUrl?: string;
};

type MediaViewerProps = {
	visible: boolean;
	media: MediaItem | MediaItem[];
	initialIndex?: number;
	onClose: () => void;
};

const MediaViewer: React.FC<MediaViewerProps> = ({
	visible,
	media,
	initialIndex = 0,
	onClose,
}) => {
	const [currentIndex, setCurrentIndex] = useState(initialIndex);
	const [isDownloading, setIsDownloading] = useState(false);
	const [scale, setScale] = useState(1);
	const [isPlaying, setIsPlaying] = useState(true);

	const flatListRef = useRef<FlatList>(null);
	const scrollX = useRef(new Animated.Value(0)).current;
	const translateY = useRef(new Animated.Value(0)).current;

	const mediaArray = Array.isArray(media) ? media : [media];
	const currentMedia = mediaArray[currentIndex];

	// Reset position and scale when visibility changes
	useEffect(() => {
		if (visible) {
			setScale(1);
			translateY.setValue(0);
		}
	}, [visible]);

	// Scroll to the initial index when the modal opens
	useEffect(() => {
		if (visible && flatListRef.current && currentIndex !== initialIndex) {
			flatListRef.current.scrollToIndex({
				index: currentIndex,
				animated: false,
			});
		}
	}, [visible, currentIndex, initialIndex]);

	// Create a player for video content
	const player = useVideoPlayer(
		currentMedia?.type?.startsWith("video/") ? currentMedia?.uri : null,
		(player) => {
			if (isPlaying) {
				player.play();
			}
		},
	);

	const onCloseHandler = () => {
		setCurrentIndex(initialIndex);
		setIsPlaying(false);
		if (player && player.pause) {
			player.pause();
		}
		onClose();
	};

	// Handle scroll events to update current index
	const handleScroll = Animated.event(
		[{ nativeEvent: { contentOffset: { x: scrollX } } }],
		{ useNativeDriver: false },
	);

	const handleMomentumScrollEnd = (event) => {
		const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
		if (newIndex !== currentIndex) {
			setCurrentIndex(newIndex);
			if (mediaArray[newIndex]?.type?.startsWith("video/")) {
				setIsPlaying(true);
			}
		}
	};

	// Handle pinch gesture to zoom images
	const onPinchGestureEvent = (event: any) => {
		setScale(Math.max(1, Math.min(event.nativeEvent.scale, 3)));
	};

	const onPinchHandlerStateChange = (event: any) => {
		if (event.nativeEvent.oldState === State.ACTIVE) {
			if (event.nativeEvent.scale < 1) {
				setScale(1);
			} else if (event.nativeEvent.scale > 3) {
				setScale(3);
			}
		}
	};

	// Vertical pan gesture for dismiss
	const onVerticalPanGestureEvent = Animated.event(
		[{ nativeEvent: { translationY: translateY } }],
		{ useNativeDriver: true },
	);

	const onVerticalPanStateChange = (event: any) => {
		if (event.nativeEvent.oldState === State.ACTIVE) {
			const dismissThreshold = height * 0.15; // 15% of screen height
			if (event.nativeEvent.translationY > dismissThreshold) {
				// Dismiss the modal
				onCloseHandler();
			} else {
				// Reset position with animation
				Animated.spring(translateY, {
					toValue: 0,
					useNativeDriver: true,
					tension: 80,
					friction: 10,
				}).start();
			}
		}
	};

	// Compute opacity based on vertical drag distance
	const backgroundOpacity = translateY.interpolate({
		inputRange: [0, height * 0.15, height * 0.3],
		outputRange: [1, 0.7, 0.5],
		extrapolate: "clamp",
	});

	// Render each media item
	const renderMediaItem = ({ item, index }) => {
		const isVideoItem = item.type?.startsWith("video/");

		return (
			<View style={[styles.mediaSlide, { width }]}>
				{isVideoItem && index === currentIndex ? (
					<VideoView
						player={player}
						style={styles.video}
						contentFit="contain"
					/>
				) : !isVideoItem ? (
					<PinchGestureHandler
						onGestureEvent={onPinchGestureEvent}
						onHandlerStateChange={onPinchHandlerStateChange}
					>
						<Image
							source={{ uri: item.uri }}
							style={[
								styles.image,
								index === currentIndex && {
									transform: [{ scale }],
								},
							]}
							resizeMode="contain"
						/>
					</PinchGestureHandler>
				) : (
					// For video items not currently shown, display thumbnail
					<View style={styles.videoPlaceholder}>
						<Image
							source={{ uri: item.thumbnailUrl || item.uri }}
							style={styles.videoThumbnail}
							resizeMode="contain"
						/>
						<View style={styles.playButtonOverlay}>
							<Ionicons
								name="play-circle"
								size={64}
								color="#fff"
							/>
						</View>
					</View>
				)}
			</View>
		);
	};

	// Navigation functions
	const handleNext = () => {
		if (currentIndex < mediaArray.length - 1 && flatListRef.current) {
			flatListRef.current.scrollToIndex({
				index: currentIndex + 1,
				animated: true,
			});
		}
	};

	const handlePrevious = () => {
		if (currentIndex > 0 && flatListRef.current) {
			flatListRef.current.scrollToIndex({
				index: currentIndex - 1,
				animated: true,
			});
		}
	};

	const handleDownload = async () => {
		try {
			// Request permissions
			const { status } = await MediaLibrary.requestPermissionsAsync();
			if (status !== "granted") {
				Alert.alert(
					"Permission Required",
					"Please grant media library permissions to save media.",
				);
				return;
			}

			setIsDownloading(true);

			const fileUri = currentMedia.uri;
			const fileExtension = fileUri.split(".").pop();
			const fileName =
				currentMedia.name || `${Date.now()}.${fileExtension}`;

			// Create a unique local file path
			const localDir = FileSystem.documentDirectory + "downloads/";
			const localFilePath = localDir + fileName;

			// Ensure directory exists
			const dirInfo = await FileSystem.getInfoAsync(localDir);
			if (!dirInfo.exists) {
				await FileSystem.makeDirectoryAsync(localDir, {
					intermediates: true,
				});
			}

			// Download file to local storage
			await FileSystem.downloadAsync(fileUri, localFilePath);

			// Save to media library based on file type
			if (currentMedia.type.startsWith("image/")) {
				await MediaLibrary.saveToLibraryAsync(localFilePath);
			} else if (currentMedia.type.startsWith("video/")) {
				await MediaLibrary.saveToLibraryAsync(localFilePath);
			}

			Alert.alert("Success", "Media saved to your device");
		} catch (error) {
			console.error("Error saving media:", error);
			Alert.alert("Error", "Failed to save media to your device");
		} finally {
			setIsDownloading(false);
		}
	};

	const handleShare = async () => {
		try {
			setIsDownloading(true);

			const fileUri = currentMedia.uri;
			const fileExtension = fileUri.split(".").pop();
			const fileName =
				currentMedia.name || `${Date.now()}.${fileExtension}`;

			// Create temp file for sharing
			const localFilePath = FileSystem.cacheDirectory + fileName;

			// Download file to temp storage
			await FileSystem.downloadAsync(fileUri, localFilePath);

			// Share the file
			if (await Sharing.isAvailableAsync()) {
				await Sharing.shareAsync(localFilePath);
			} else {
				Alert.alert(
					"Sharing not available",
					"Sharing is not available on this device",
				);
			}
		} catch (error) {
			console.error("Error sharing media:", error);
			Alert.alert("Error", "Failed to share media");
		} finally {
			setIsDownloading(false);
		}
	};

	if (!visible || !currentMedia) return null;

	return (
		<Modal visible={visible} transparent={true} animationType="fade">
			<StatusBar style="light" />
			<GestureHandlerRootView style={{ flex: 1 }}>
				<PanGestureHandler
					onGestureEvent={onVerticalPanGestureEvent}
					onHandlerStateChange={onVerticalPanStateChange}
					activeOffsetY={[-20, 20]}
					failOffsetX={[-20, 20]}
				>
					<Animated.View
						style={[
							styles.container,
							{
								transform: [{ translateY }],
								opacity: backgroundOpacity,
							},
						]}
					>
						<SafeAreaView style={{ flex: 1 }}>
							<View style={styles.header}>
								<TouchableOpacity
									style={styles.closeButton}
									onPress={onCloseHandler}
								>
									<Ionicons
										name="close"
										size={28}
										color="#fff"
									/>
								</TouchableOpacity>
								<Text style={styles.fileName}>
									{currentMedia.name || "Media"}
								</Text>
								<View style={styles.headerActions}>
									<TouchableOpacity
										style={styles.actionButton}
										onPress={handleShare}
										disabled={isDownloading}
									>
										<Ionicons
											name="share-outline"
											size={24}
											color="#fff"
										/>
									</TouchableOpacity>
									<TouchableOpacity
										style={styles.actionButton}
										onPress={handleDownload}
										disabled={isDownloading}
									>
										{isDownloading ? (
											<ActivityIndicator
												color="#fff"
												size="small"
											/>
										) : (
											<Ionicons
												name="download-outline"
												size={24}
												color="#fff"
											/>
										)}
									</TouchableOpacity>
								</View>
							</View>

							{/* Carousel FlatList for media */}
							<View style={styles.carouselContainer}>
								<Animated.FlatList
									ref={flatListRef}
									data={mediaArray}
									renderItem={renderMediaItem}
									keyExtractor={(_, index) =>
										`media-${index}`
									}
									horizontal
									pagingEnabled
									showsHorizontalScrollIndicator={false}
									initialScrollIndex={currentIndex}
									getItemLayout={(_, index) => ({
										length: width,
										offset: width * index,
										index,
									})}
									onScroll={handleScroll}
									onMomentumScrollEnd={
										handleMomentumScrollEnd
									}
									scrollEventThrottle={16}
									decelerationRate="fast"
								/>
							</View>

							{mediaArray.length > 1 && (
								<View style={styles.navigationContainer}>
									<TouchableOpacity
										style={[
											styles.navButton,
											currentIndex === 0 &&
												styles.disabledButton,
										]}
										onPress={handlePrevious}
										disabled={currentIndex === 0}
									>
										<Ionicons
											name="chevron-back"
											size={24}
											color="#fff"
										/>
									</TouchableOpacity>
									<Text style={styles.paginationText}>
										{currentIndex + 1} / {mediaArray.length}
									</Text>
									<TouchableOpacity
										style={[
											styles.navButton,
											currentIndex ===
												mediaArray.length - 1 &&
												styles.disabledButton,
										]}
										onPress={handleNext}
										disabled={
											currentIndex ===
											mediaArray.length - 1
										}
									>
										<Ionicons
											name="chevron-forward"
											size={24}
											color="#fff"
										/>
									</TouchableOpacity>
								</View>
							)}

							{/* Visual indicators for gestures */}
							<View style={styles.gestureHintContainer}>
								<Text style={styles.gestureHintText}>
									Swipe left/right to navigate • Pull down to
									dismiss
								</Text>
							</View>
						</SafeAreaView>
					</Animated.View>
				</PanGestureHandler>
			</GestureHandlerRootView>
		</Modal>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 16,
		paddingTop: Platform.OS === "android" ? 40 : 16,
	},
	closeButton: {
		padding: 8,
	},
	fileName: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "600",
		flex: 1,
		textAlign: "center",
		marginHorizontal: 16,
	},
	headerActions: {
		flexDirection: "row",
	},
	actionButton: {
		padding: 8,
		marginLeft: 8,
	},
	carouselContainer: {
		flex: 1,
		justifyContent: "center",
	},
	mediaSlide: {
		width,
		height: height * 0.7,
		justifyContent: "center",
		alignItems: "center",
	},
	image: {
		width,
		height: height * 0.7,
	},
	video: {
		width,
		height: height * 0.7,
	},
	videoPlaceholder: {
		width: "100%",
		height: "100%",
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#000",
	},
	videoThumbnail: {
		width: "100%",
		height: "100%",
		opacity: 0.7,
	},
	playButtonOverlay: {
		position: "absolute",
		justifyContent: "center",
		alignItems: "center",
	},
	navigationContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		paddingBottom: Platform.OS === "android" ? 40 : 16,
	},
	navButton: {
		padding: 12,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		borderRadius: 30,
	},
	disabledButton: {
		opacity: 0.5,
	},
	paginationText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "600",
	},
	gestureHintContainer: {
		position: "absolute",
		bottom: Platform.OS === "ios" ? 30 : 50,
		alignSelf: "center",
		backgroundColor: "rgba(0,0,0,0.5)",
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 20,
	},
	gestureHintText: {
		color: "#fff",
		fontSize: 12,
		textAlign: "center",
		opacity: 0.8,
	},
});

export default MediaViewer;
