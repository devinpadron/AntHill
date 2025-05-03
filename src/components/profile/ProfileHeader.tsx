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
		<TouchableOpacity onPress={onNamePress}>
			<Text style={[styles.headerTitle, styles.underline]}>
				{firstName} {lastName}
			</Text>
		</TouchableOpacity>
	</View>
);

const styles = StyleSheet.create({
	header: {
		display: "flex",
		marginBottom: 24,
		justifyContent: "center",
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
	},
	underline: {
		textDecorationLine: "underline",
	},
});
