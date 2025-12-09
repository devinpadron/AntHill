import React from "react";
import { View, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

export const Skeleton = ({
	width = "100%",
	height = 40,
	borderRadius = 8,
	style,
}) => {
	const { theme } = useTheme();
	return (
		<View
			style={[
				styles.skeleton,
				{
					width,
					height,
					borderRadius,
					backgroundColor: theme.TertiaryText,
				},
				style,
			]}
		/>
	);
};

const styles = StyleSheet.create({
	skeleton: {
		opacity: 0.3,
	},
});
