import React from "react";
import {
	View,
	Image,
	Text,
	StyleSheet,
	ViewStyle,
	StyleProp,
	ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { AvatarSize } from "../../constants/tokens";
import { FontFamily } from "../../constants/tokens";

interface AvatarProps {
	source?: ImageSourcePropType | string;
	name?: string;
	size?: keyof typeof AvatarSize | number;
	fallbackIcon?: keyof typeof Ionicons.glyphMap;
	showBadge?: boolean;
	badgeColor?: string;
	style?: StyleProp<ViewStyle>;
}

// Tint pairs (bg, fg) — matches ui.jsx AVATAR_TINTS so the family stays consistent.
const AVATAR_TINTS: Array<[string, string]> = [
	["#E7E9D4", "#475821"],
	["#F2D9CB", "#8E4029"],
	["#F0E0BE", "#A8821F"],
	["#CFE1E7", "#3F7184"],
	["#E3D5C5", "#6B5A45"],
	["#D8E5D0", "#3F6A4A"],
	["#F5D6D6", "#923A3A"],
	["#E1D6E8", "#52406F"],
];

function tintFor(seed: string): [string, string] {
	let h = 0;
	for (let i = 0; i < seed.length; i++) {
		h = (h * 31 + seed.charCodeAt(i)) >>> 0;
	}
	return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

function resolveSize(size: AvatarProps["size"]): number {
	if (typeof size === "number") return size;
	return AvatarSize[size ?? "md"];
}

export const Avatar: React.FC<AvatarProps> = ({
	source,
	name,
	size = "md",
	fallbackIcon = "person",
	showBadge = false,
	badgeColor,
	style,
}) => {
	const { theme } = useTheme();
	const avatarSize = resolveSize(size);

	const [bg, fg] = name ? tintFor(name) : [theme.AccentSoft, theme.Accent];
	const initials = name
		? name
				.split(/\s+/)
				.slice(0, 2)
				.map((n) => n[0]?.toUpperCase() ?? "")
				.join("")
		: "";

	const imageSource = typeof source === "string" ? { uri: source } : source;
	const badgeSize = Math.max(8, Math.round(avatarSize * 0.28));

	return (
		<View style={styles.container}>
			<View
				style={[
					styles.avatar,
					{
						width: avatarSize,
						height: avatarSize,
						borderRadius: avatarSize / 2,
						backgroundColor: bg,
					},
					style,
				]}
			>
				{source ? (
					<Image
						source={imageSource}
						style={{
							width: avatarSize,
							height: avatarSize,
							borderRadius: avatarSize / 2,
							resizeMode: "cover",
						}}
					/>
				) : initials ? (
					<Text
						style={{
							fontFamily: FontFamily.ui,
							fontWeight: "600",
							fontSize: avatarSize * 0.36,
							letterSpacing: 0.2,
							color: fg,
						}}
					>
						{initials}
					</Text>
				) : (
					<Ionicons
						name={fallbackIcon}
						size={avatarSize * 0.5}
						color={fg}
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
							backgroundColor: badgeColor ?? theme.Success,
							borderColor: theme.Surface,
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
	badge: {
		position: "absolute",
		right: 0,
		top: 0,
		borderWidth: 2,
	},
});
