import React from "react";
import {
	View,
	Image,
	StyleSheet,
	ViewStyle,
	StyleProp,
	ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

interface AvatarProps {
	source?: ImageSourcePropType | string;
	size?: "xs" | "sm" | "md" | "lg" | "xl";
	fallbackIcon?: keyof typeof Ionicons.glyphMap;
	showBadge?: boolean;
	badgeColor?: string;
	style?: StyleProp<ViewStyle>;
}

export const Avatar: React.FC<AvatarProps> = ({
	source,
	size = "md",
	fallbackIcon = "person",
	showBadge = false,
	badgeColor,
	style,
}) => {
	const { theme } = useTheme();

	const getSize = () => {
		switch (size) {
			case "xs":
				return 24;
			case "sm":
				return 32;
			case "md":
				return 40;
			case "lg":
				return 56;
			case "xl":
				return 80;
			default:
				return 40;
		}
	};

	const getIconSize = () => {
		switch (size) {
			case "xs":
				return 12;
			case "sm":
				return 16;
			case "md":
				return 20;
			case "lg":
				return 28;
			case "xl":
				return 40;
			default:
				return 20;
		}
	};

	const getBadgeSize = () => {
		switch (size) {
			case "xs":
				return 8;
			case "sm":
				return 10;
			case "md":
				return 12;
			case "lg":
				return 14;
			case "xl":
				return 16;
			default:
				return 12;
		}
	};

	const avatarSize = getSize();
	const iconSize = getIconSize();
	const badgeSize = getBadgeSize();

	const avatarStyles = [
		styles.avatar,
		{
			width: avatarSize,
			height: avatarSize,
			borderRadius: avatarSize / 2,
			backgroundColor: theme.ProfileBackground,
		},
		style,
	];

	// Handle both URI string and require() source
	const imageSource = typeof source === "string" ? { uri: source } : source;

	return (
		<View style={styles.container}>
			<View style={avatarStyles}>
				{source ? (
					<Image
						source={imageSource}
						style={[
							styles.image,
							{
								width: avatarSize,
								height: avatarSize,
								borderRadius: avatarSize / 2,
							},
						]}
					/>
				) : (
					<Ionicons
						name={fallbackIcon}
						size={iconSize}
						color={theme.SecondaryText}
					/>
				)}
			</View>
			{showBadge && (
				<View
					style={[
						styles.badge,
						{
							width: badgeSize,
							height: badgeSize,
							borderRadius: badgeSize / 2,
							backgroundColor:
								badgeColor || theme.NotificationGreen,
							borderColor: theme.CardBackground,
						},
					]}
				/>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		position: "relative",
	},
	avatar: {
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
	},
	image: {
		resizeMode: "cover",
	},
	badge: {
		position: "absolute",
		right: 0,
		top: 0,
		borderWidth: 2,
	},
});
