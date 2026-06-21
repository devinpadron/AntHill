import React from "react";
import { View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

interface DividerProps {
	inset?: number;
	soft?: boolean;
}

/**
 * Hairline divider. Use `soft` for in-card separators and the default for
 * stronger section breaks.
 */
export const Divider: React.FC<DividerProps> = ({
	inset = 0,
	soft = false,
}) => {
	const { theme } = useTheme();
	return (
		<View
			style={{
				height: 0.5,
				marginLeft: inset,
				backgroundColor: soft ? theme.BorderSoft : theme.BorderColor,
			}}
		/>
	);
};
