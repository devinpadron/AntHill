import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { Cream, Olive, Terra } from "../../constants/colors";
import { FontFamily, BorderRadius } from "../../constants/tokens";
import { Text } from "./Text";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { AntGlyph } from "./brand/AntGlyph";

interface TopBarProps {
	name?: string;
	companyName?: string;
	unread?: number;
	onPressCompany?: () => void;
	onPressBell?: () => void;
	onPressAvatar?: () => void;
}

/**
 * Top header: company-switcher chip on the left, bell + avatar on the right.
 * Translated from the design hand-off `TopBar` in ui.jsx.
 */
export const TopBar: React.FC<TopBarProps> = ({
	name = "",
	companyName = "",
	unread = 0,
	onPressCompany,
	onPressBell,
	onPressAvatar,
}) => {
	const { theme, mode } = useTheme();
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				paddingHorizontal: 20,
				paddingTop: 4,
				paddingBottom: 8,
			}}
		>
			<TouchableOpacity
				onPress={onPressCompany}
				activeOpacity={0.8}
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					paddingVertical: 6,
					paddingLeft: 6,
					paddingRight: 10,
					borderRadius: BorderRadius.pill,
					backgroundColor:
						mode === "dark"
							? "rgba(255,255,255,0.08)"
							: "rgba(29,29,39,0.04)",
				}}
			>
				<View
					style={{
						width: 22,
						height: 22,
						borderRadius: 11,
						backgroundColor: Olive[600],
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<AntGlyph size={14} color={Cream[50]} />
				</View>
				<Text
					style={{
						fontFamily: FontFamily.ui,
						fontSize: 12.5,
						fontWeight: "600",
						color: theme.PrimaryText,
					}}
				>
					{companyName || "anthill"}
				</Text>
				<Icon name="chevD" size={14} color={theme.TertiaryText} />
			</TouchableOpacity>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
				}}
			>
				<TouchableOpacity
					onPress={onPressBell}
					activeOpacity={0.8}
					style={{
						width: 38,
						height: 38,
						borderRadius: 19,
						backgroundColor: theme.Surface,
						borderWidth: 0.5,
						borderColor: theme.BorderColor,
						alignItems: "center",
						justifyContent: "center",
						position: "relative",
					}}
				>
					<Icon name="bell" size={18} color={theme.PrimaryText} />
					{unread > 0 && (
						<View
							style={{
								position: "absolute",
								top: 7,
								right: 8,
								width: 8,
								height: 8,
								borderRadius: 4,
								backgroundColor: Terra[500],
								borderWidth: 2,
								borderColor: theme.Surface,
							}}
						/>
					)}
				</TouchableOpacity>
				<TouchableOpacity onPress={onPressAvatar} activeOpacity={0.8}>
					<Avatar name={name || "User"} size={38} />
				</TouchableOpacity>
			</View>
		</View>
	);
};
