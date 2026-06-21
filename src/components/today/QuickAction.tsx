import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Cream, Olive } from "../../constants/colors";
import { BorderRadius, Shadow } from "../../constants/tokens";
import { Icon, IconName } from "../ui/Icon";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";

interface QuickActionProps {
	icon: IconName;
	label: string;
	sub?: string;
	onPress?: () => void;
}

export const QuickAction: React.FC<QuickActionProps> = ({
	icon,
	label,
	sub,
	onPress,
}) => {
	const { theme } = useTheme();
	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.85}
			style={{
				backgroundColor: theme.Surface,
				borderRadius: BorderRadius.lg,
				padding: 14,
				borderWidth: 0.5,
				borderColor: theme.BorderSoft,
				gap: 8,
				...Shadow.sm,
			}}
		>
			<View
				style={{
					width: 32,
					height: 32,
					borderRadius: 10,
					backgroundColor: Cream[100],
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Icon name={icon} size={18} color={Olive[700]} />
			</View>
			<View>
				<Text variant="caption" weight="semibold">
					{label}
				</Text>
				{sub && (
					<Text
						variant="small"
						color="tertiary"
						style={{ marginTop: 1 }}
					>
						{sub}
					</Text>
				)}
			</View>
		</TouchableOpacity>
	);
};
