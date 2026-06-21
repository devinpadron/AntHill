import React from "react";
import { View, TouchableOpacity, Platform } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "../../contexts/ThemeContext";
import { Ink, Olive } from "../../constants/colors";
import { Icon, IconName } from "./Icon";
import { Text } from "./Text";

/**
 * Floating glass-blur bottom tab bar. Drops into React Navigation's
 * `tabBar` slot:
 *
 *   <Tab.Navigator tabBar={(props) => <TabBar {...props} />}>
 */

const ROUTE_ICON: Record<string, IconName> = {
	Today: "home",
	Home: "home",
	Calendar: "cal",
	Clock: "clock",
	Timesheet: "clock",
	Availability: "swap",
	Settings: "user",
	Me: "user",
	Notifications: "bell",
};

export const TabBar: React.FC<BottomTabBarProps> = ({
	state,
	descriptors,
	navigation,
}) => {
	const { theme } = useTheme();

	return (
		<View
			style={{
				position: "absolute",
				left: 12,
				right: 12,
				bottom: Platform.OS === "ios" ? 24 : 16,
				flexDirection: "row",
				justifyContent: "space-around",
				alignItems: "center",
				backgroundColor: "rgba(255,254,250,0.92)",
				borderRadius: 28,
				borderWidth: 0.5,
				borderColor: theme.BorderStrong,
				paddingVertical: 8,
				paddingHorizontal: 8,
				shadowColor: Ink[900],
				shadowOffset: { width: 0, height: 10 },
				shadowOpacity: 0.1,
				shadowRadius: 30,
				elevation: 10,
			}}
		>
			{state.routes.map((route, index) => {
				const { options } = descriptors[route.key];
				const label = (options.tabBarLabel ??
					options.title ??
					route.name) as string;
				const focused = state.index === index;
				const iconName: IconName = ROUTE_ICON[route.name] ?? "home";

				const onPress = () => {
					const event = navigation.emit({
						type: "tabPress",
						target: route.key,
						canPreventDefault: true,
					});
					if (!focused && !event.defaultPrevented) {
						navigation.navigate(route.name, route.params);
					}
				};

				return (
					<TouchableOpacity
						key={route.key}
						accessibilityRole="button"
						accessibilityState={focused ? { selected: true } : {}}
						accessibilityLabel={
							options.tabBarAccessibilityLabel ?? label
						}
						onPress={onPress}
						activeOpacity={0.85}
						style={{
							flex: 1,
							alignItems: "center",
							paddingVertical: 6,
							paddingHorizontal: 4,
							gap: 2,
							borderRadius: 18,
							backgroundColor: focused
								? Olive[100]
								: "transparent",
							minHeight: 48,
							justifyContent: "center",
						}}
					>
						<Icon
							name={iconName}
							size={20}
							color={focused ? Olive[700] : Ink[500]}
							strokeWidth={focused ? 1.9 : 1.6}
						/>
						<Text
							variant="small"
							style={{
								fontSize: 10.5,
								color: focused ? Olive[700] : Ink[500],
								fontWeight: focused ? "600" : "500",
								letterSpacing: 0.1,
							}}
						>
							{label}
						</Text>
					</TouchableOpacity>
				);
			})}
		</View>
	);
};
