import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type EventFormHeaderProps = {
	title: string;
	onBack: () => void;
};

export const EventFormHeader = ({ title, onBack }: EventFormHeaderProps) => (
	<View style={styles.header}>
		<TouchableOpacity onPress={onBack} style={styles.backButton}>
			<Ionicons name="chevron-back" size={28} color="#000" />
		</TouchableOpacity>
		<Text style={styles.headerTitle}>{title}</Text>
	</View>
);

const styles = StyleSheet.create({
	header: {
		display: "flex",
		marginBottom: 20,
		justifyContent: "center",
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#333",
		textAlign: "center",
	},
	backButton: {
		position: "absolute",
		left: 0,
		zIndex: 1,
	},
});
