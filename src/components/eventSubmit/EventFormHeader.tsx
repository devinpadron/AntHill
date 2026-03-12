import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, IconSize } from "../../constants/tokens";

type EventFormHeaderProps = {
	title: string;
	onBack: () => void;
};

export const EventFormHeader = ({ title, onBack }: EventFormHeaderProps) => {
	const { theme } = useTheme();

	return (
		<View style={styles.header}>
			<TouchableOpacity onPress={onBack} style={styles.backButton}>
				<Ionicons
					name="chevron-back"
					size={IconSize.lg}
					color={theme.PrimaryText}
				/>
			</TouchableOpacity>
			<Text variant="h2" weight="bold" color="primary" align="center">
				{title}
			</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	header: {
		display: "flex",
		marginBottom: Spacing.xl,
		justifyContent: "center",
	},
	backButton: {
		position: "absolute",
		left: 0,
		zIndex: 1,
	},
});
