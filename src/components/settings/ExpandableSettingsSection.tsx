import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	LayoutAnimation,
	Platform,
	UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Enable LayoutAnimation for Android
if (Platform.OS === "android") {
	if (UIManager.setLayoutAnimationEnabledExperimental) {
		UIManager.setLayoutAnimationEnabledExperimental(true);
	}
}

type ExpandableSettingsSectionProps = {
	title: string;
	children: React.ReactNode;
	initiallyExpanded?: boolean;
};

export const ExpandableSettingsSection: React.FC<
	ExpandableSettingsSectionProps
> = ({ title, children, initiallyExpanded = false }) => {
	const [expanded, setExpanded] = useState(initiallyExpanded);

	const toggleExpand = () => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setExpanded(!expanded);
	};

	return (
		<View style={styles.container}>
			<TouchableOpacity
				style={styles.headerContainer}
				onPress={toggleExpand}
				activeOpacity={0.7}
			>
				<Text style={styles.headerTitle}>{title}</Text>
				<Ionicons
					name={expanded ? "chevron-up" : "chevron-down"}
					size={20}
					color="#888"
				/>
			</TouchableOpacity>

			{expanded && (
				<View style={styles.contentContainer}>{children}</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
	},
	headerContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 15,
		paddingHorizontal: 16,
	},
	headerTitle: {
		fontSize: 16,
		fontWeight: "500",
		color: "#333",
	},
	contentContainer: {
		paddingLeft: 8,
	},
});
