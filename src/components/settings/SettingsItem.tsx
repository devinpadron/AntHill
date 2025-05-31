import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

type SettingsItemProps = {
	title: string;
	onPress: () => void;
	isAction?: boolean;
	style?: any; // Add this line to accept custom styles
};

export const SettingsItem: React.FC<SettingsItemProps> = ({
	title,
	onPress,
	isAction = false,
	style, // Accept style prop
}) => {
	return (
		<TouchableOpacity
			style={[styles.container, isAction && styles.actionItem, style]} // Merge styles
			onPress={onPress}
		>
			<Text style={[styles.title, isAction && styles.actionTitle]}>
				{title}
			</Text>
			<Ionicons name="chevron-forward-outline" size={20} color="#888" />
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
	},
	title: {
		fontSize: 16,
	},
	actionItem: {
		// Define styles for action item if needed
	},
	actionTitle: {
		color: "red",
	},
});
