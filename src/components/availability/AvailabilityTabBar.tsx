import React, { useState, useEffect } from "react";
import {
	View,
	TouchableOpacity,
	Animated,
	StyleSheet,
	Dimensions,
} from "react-native";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, Shadow } from "../../constants/tokens";

const { width: screenWidth } = Dimensions.get("window");

export type AvailabilityTab = "unconfirmed" | "confirmed" | "declined";

const TABS: { key: AvailabilityTab; label: string }[] = [
	{ key: "unconfirmed", label: "Unconfirmed" },
	{ key: "confirmed", label: "Confirmed" },
	{ key: "declined", label: "Declined" },
];

interface AvailabilityTabBarProps {
	activeTab: AvailabilityTab;
	onTabChange: (tab: AvailabilityTab) => void;
}

const TabIndicator: React.FC<{ activeTab: AvailabilityTab }> = ({
	activeTab,
}) => {
	const { theme } = useTheme();
	const [translateX] = useState(new Animated.Value(0));

	useEffect(() => {
		const position = TABS.findIndex((t) => t.key === activeTab);
		const tabWidth = (screenWidth - Spacing.lg * 2) / 3;
		const indicatorWidth = tabWidth * 0.6;
		const centerOffset = (tabWidth - indicatorWidth) / 2;

		Animated.spring(translateX, {
			toValue: position * tabWidth + centerOffset,
			useNativeDriver: true,
			friction: 8,
		}).start();
	}, [activeTab, translateX]);

	const tabWidth = (screenWidth - Spacing.lg * 2) / 3;
	const indicatorWidth = tabWidth * 0.6;

	return (
		<Animated.View
			style={[
				styles.indicator,
				{
					width: indicatorWidth,
					backgroundColor: theme.LocationBlue,
					transform: [{ translateX }],
				},
			]}
		/>
	);
};

export const AvailabilityTabBar: React.FC<AvailabilityTabBarProps> = ({
	activeTab,
	onTabChange,
}) => {
	const { theme } = useTheme();

	return (
		<View
			style={[
				styles.outerContainer,
				{ backgroundColor: theme.CardBackground },
			]}
		>
			<View style={styles.container}>
				{TABS.map((tab) => (
					<TouchableOpacity
						key={tab.key}
						style={styles.tab}
						onPress={() => onTabChange(tab.key)}
						activeOpacity={0.7}
					>
						<Text
							variant="caption"
							weight={activeTab === tab.key ? "bold" : "semibold"}
							color={activeTab === tab.key ? "info" : "secondary"}
						>
							{tab.label}
						</Text>
					</TouchableOpacity>
				))}
				<TabIndicator activeTab={activeTab} />
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	outerContainer: {
		paddingHorizontal: Spacing.lg,
		marginBottom: Spacing.lg,
		...Shadow.sm,
	},
	container: {
		flexDirection: "row",
		position: "relative",
		height: 48,
	},
	tab: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	indicator: {
		position: "absolute",
		bottom: 0,
		height: 3,
		borderRadius: 3,
	},
});
