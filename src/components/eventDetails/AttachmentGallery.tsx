import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	Dimensions,
	ImageBackground,
	TouchableOpacity,
	Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ImageView from "react-native-image-viewing";
import { FileUpload } from "../../types";

type AttachmentGalleryProps = {
	attachments: FileUpload[];
};

export const AttachmentGallery = ({ attachments }: AttachmentGalleryProps) => {
	const [visible, setIsVisible] = useState(false);
	const [imageIndex, setImageIndex] = useState(0);

	const imageFiles = attachments.filter((file) =>
		file.type.startsWith("image/"),
	);
	const images = imageFiles.map((file) => ({ uri: file.url }));
	const documentFiles = attachments.filter(
		(file) => !file.type.startsWith("image/"),
	);

	if (attachments.length === 0) {
		return null;
	}

	return (
		<View style={styles.filesContainer}>
			{/* Image Gallery */}
			{imageFiles.length > 0 && (
				<>
					<ImageView
						images={images}
						imageIndex={imageIndex}
						visible={visible}
						onRequestClose={() => setIsVisible(false)}
					/>
					<View style={styles.imageGrid}>
						{imageFiles.map((file, index) => (
							<View key={index} style={styles.thumbnailContainer}>
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

			{/* Document List */}
			{documentFiles.length > 0 && (
				<View style={styles.documentList}>
					{documentFiles.map((file, index) => (
						<TouchableOpacity
							key={index}
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
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	filesContainer: {
		marginTop: 16,
	},
	imageGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
		marginBottom: 10,
		paddingBottom: 20,
	},
	thumbnailContainer: {
		width: "30%", // 3 columns with padding
		aspectRatio: 1,
		borderRadius: 8,
		backgroundColor: "#f5f5f5",
		position: "relative",
		overflow: "visible",
	},
	thumbnail: {
		width: (Dimensions.get("window").width - 60) / 3,
		height: "100%",
		borderRadius: 8,
		zIndex: 1,
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
});
