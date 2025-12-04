import React from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing } from "../../constants/tokens";

interface LoadingScreenProps {
	message?: string;
	fullScreen?: boolean;
}

/**
 * LoadingScreen - A standardized loading indicator
 *
 * Use this component to show loading states consistently across the app.
 *
 * @example
 * ```tsx
 * if (isLoading) {
 *   return <LoadingScreen message="Loading events..." />;
 * }
 * ```
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({
	message = "Loading...",
	fullScreen = true,
}) => {
	const { theme } = useTheme();

	const containerStyle = fullScreen
		? styles.fullScreenContainer
		: styles.inlineContainer;

	return (
		<View
			style={[
				containerStyle,
				{
					backgroundColor: fullScreen
						? theme.Background
						: "transparent",
				},
			]}
		>
			<ActivityIndicator size="large" color={theme.LocationBlue} />
			{message && (
				<Text
					variant="body"
					color="secondary"
					align="center"
					style={styles.message}
				>
					{message}
				</Text>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	fullScreenContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	inlineContainer: {
		padding: Spacing.xl,
		justifyContent: "center",
		alignItems: "center",
	},
	message: {
		marginTop: Spacing.md,
	},
});
