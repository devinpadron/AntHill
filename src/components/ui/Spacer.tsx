import React from "react";
import { View, ViewStyle } from "react-native";

type SpacerSize = "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "xxxl";
type SpacerDirection = "horizontal" | "vertical";

interface SpacerProps {
	size?: SpacerSize;
	direction?: SpacerDirection;
	custom?: number;
}

const spacingMap: Record<SpacerSize, number> = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 20,
	xxl: 24,
	xxxl: 32,
};

export const Spacer: React.FC<SpacerProps> = ({
	size = "md",
	direction = "vertical",
	custom,
}) => {
	const spacing = custom ?? spacingMap[size];

	const style: ViewStyle =
		direction === "vertical" ? { height: spacing } : { width: spacing };

	return <View style={style} />;
};
