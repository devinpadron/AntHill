import React from "react";
import { View } from "react-native";
import { Amber } from "../../constants/colors";
import { Icon } from "./Icon";
import { Text } from "./Text";

interface OfflineBarProps {
	lastSyncedMinutes?: number;
}

/**
 * Amber offline-indicator pill. Render at the top of a screen when network is
 * unavailable. Stale-data state.
 */
export const OfflineBar: React.FC<OfflineBarProps> = ({
	lastSyncedMinutes,
}) => {
	const suffix =
		typeof lastSyncedMinutes === "number"
			? ` — last synced ${lastSyncedMinutes} min ago`
			: "";
	return (
		<View
			style={{
				marginHorizontal: 16,
				marginBottom: 8,
				borderRadius: 999,
				paddingHorizontal: 12,
				paddingVertical: 6,
				backgroundColor: Amber[100],
				flexDirection: "row",
				alignItems: "center",
				gap: 8,
			}}
		>
			<Icon name="wifi" size={14} color={Amber[600]} />
			<Text
				variant="small"
				weight="semibold"
				style={{ color: Amber[600] }}
			>
				Offline{suffix}
			</Text>
		</View>
	);
};
