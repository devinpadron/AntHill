import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type EventHeaderProps = {
	title: string;
	onBack: () => void;
	onEdit?: () => void;
	canEdit?: boolean;
};

export const EventHeader = ({
	title,
	onBack,
	onEdit,
	canEdit = false,
}: EventHeaderProps) => {
	return (
		<View style={styles.header}>
			<TouchableOpacity style={styles.backButton} onPress={onBack}>
				<Ionicons name="chevron-back" size={28} color="#000" />
			</TouchableOpacity>

			<View style={styles.titleContainer}>
				<Text
					style={styles.title}
					numberOfLines={2}
					ellipsizeMode="tail"
				>
					{title}
				</Text>
			</View>

			{canEdit && onEdit && (
				<TouchableOpacity style={styles.editButton} onPress={onEdit}>
					<Ionicons name="create-outline" size={28} color="#000" />
				</TouchableOpacity>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	header: {
		display: "flex",
		flexDirection: "row",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
		alignItems: "center",
		minHeight: 60,
	},
	titleContainer: {
		flex: 1,
		paddingHorizontal: 10,
	},
	title: {
		fontSize: 20,
		fontWeight: "bold",
		textAlign: "center",
		flexWrap: "wrap",
	},
	backButton: {
		width: 40,
		zIndex: 1,
		paddingRight: 8,
	},
	editButton: {
		width: 40,
		zIndex: 1,
		paddingLeft: 8,
	},
});
