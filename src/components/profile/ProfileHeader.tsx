import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type ProfileHeaderProps = {
	firstName: string;
	lastName: string;
	onNamePress: () => void;
	onBackPress: () => void;
};

export const ProfileHeader = ({
	firstName,
	lastName,
	onNamePress,
	onBackPress,
}: ProfileHeaderProps) => (
	<View style={styles.header}>
		<TouchableOpacity style={styles.backButton} onPress={onBackPress}>
			<Ionicons name="chevron-back" size={28} color="#000" />
		</TouchableOpacity>

		<View style={styles.nameContainer}>
			<TouchableOpacity onPress={onNamePress}>
				<Text
					style={[styles.headerTitle, styles.underline]}
					numberOfLines={2}
					ellipsizeMode="tail"
				>
					{firstName} {lastName}
				</Text>
			</TouchableOpacity>
		</View>
	</View>
);

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 24,
		paddingHorizontal: 20,
		position: "relative",
	},
	nameContainer: {
		flex: 1,
		alignItems: "center",
		paddingHorizontal: 40, // Add padding to prevent overlap with back button
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: "bold",
		textAlign: "center",
	},
	backButton: {
		position: "absolute",
		left: 20,
		zIndex: 1,
		padding: 5, // Add some padding for easier touch
	},
	underline: {
		textDecorationLine: "underline",
	},
});
