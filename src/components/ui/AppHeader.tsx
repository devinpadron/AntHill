import React from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ViewStyle,
	TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

interface AppHeaderProps {
	title: string;
	onBack?: () => void;
	onAction?: () => void;
	actionIcon?: keyof typeof Ionicons.glyphMap;
	actionLabel?: string;
	canPerformAction?: boolean;
	showBackButton?: boolean;
	style?: ViewStyle;
	titleStyle?: TextStyle;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
	title,
	onBack,
	onAction,
	actionIcon = "create-outline",
	actionLabel,
	canPerformAction = true,
	showBackButton = true,
	style,
	titleStyle,
}) => {
	const { theme } = useTheme();

	return (
		<View
			style={[
				styles.header,
				{
					borderBottomColor: theme.DateBadge,
					backgroundColor: theme.Background,
				},
				style,
			]}
		>
			<View style={styles.sideSlot}>
				{showBackButton && onBack && (
					<TouchableOpacity
						style={styles.backButton}
						onPress={onBack}
						hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
					>
						<Ionicons
							name="chevron-back"
							size={28}
							color={theme.PrimaryText}
						/>
					</TouchableOpacity>
				)}
			</View>

			<View
				style={[
					styles.titleContainer,
					styles.titleContainerCentered,
					!showBackButton && styles.titleContainerNoBack,
				]}
			>
				<Text
					style={[
						styles.title,
						{ color: theme.PrimaryText },
						styles.titleCentered,
						titleStyle,
					]}
				>
					{title}
				</Text>
			</View>

			<View style={styles.sideSlot}>
				{canPerformAction && onAction && (
					<TouchableOpacity
						style={styles.actionButton}
						onPress={onAction}
						hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
					>
						{actionLabel ? (
							<Text
								style={[
									styles.actionLabel,
									{ color: theme.PrimaryText },
								]}
							>
								{actionLabel}
							</Text>
						) : (
							<Ionicons
								name={actionIcon}
								size={28}
								color={theme.PrimaryText}
							/>
						)}
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		alignItems: "center",
		minHeight: 60,
	},
	sideSlot: {
		width: 96,
		justifyContent: "center",
	},
	backButton: {
		width: 40,
		zIndex: 1,
		paddingRight: 8,
	},
	titleContainer: {
		flex: 1,
		paddingHorizontal: 10,
	},
	titleContainerCentered: {
		alignItems: "center",
		justifyContent: "center",
	},
	titleContainerNoBack: {
		paddingLeft: 0,
	},
	title: {
		fontSize: 20,
		fontWeight: "bold",
		flexWrap: "wrap",
	},
	titleCentered: {
		textAlign: "center",
	},
	actionButton: {
		width: "100%",
		zIndex: 1,
		paddingLeft: 8,
		alignItems: "flex-end",
	},
	actionLabel: {
		fontSize: 16,
		fontWeight: "600",
	},
});
