import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text } from "../ui/Text";

interface SectionHeaderProps {
	title: string;
	trailing?: string;
	onPressTrailing?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
	title,
	trailing,
	onPressTrailing,
}) => {
	return (
		<View
			style={{
				paddingHorizontal: 22,
				paddingTop: 22,
				paddingBottom: 10,
				flexDirection: "row",
				justifyContent: "space-between",
				alignItems: "baseline",
			}}
		>
			<Text variant="caption" weight="semibold">
				{title}
			</Text>
			{trailing && (
				<TouchableOpacity onPress={onPressTrailing} hitSlop={8}>
					<Text variant="small" color="tertiary" weight="medium">
						{trailing}
					</Text>
				</TouchableOpacity>
			)}
		</View>
	);
};
