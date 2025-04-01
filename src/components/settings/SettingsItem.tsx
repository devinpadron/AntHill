import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

export const SettingsItem: React.FC<{
	title: string;
	isAction?: boolean;
	onPress: () => void;
}> = ({ title, isAction = false, onPress }) => (
	<TouchableOpacity style={styles.settingsItem} onPress={onPress}>
		<Text style={[styles.settingsItemText, isAction && styles.actionText]}>
			{title}
		</Text>
		{!isAction && (
			<Ionicons name="chevron-forward-outline" size={20} color="#888" />
		)}
	</TouchableOpacity>
);

const styles = StyleSheet.create({
	settingsItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
	},
	settingsItemText: {
		fontSize: 16,
	},
	actionText: {
		color: "red",
	},
});
