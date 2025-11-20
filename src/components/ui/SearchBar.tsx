import React from "react";
import {
	View,
	TextInput,
	StyleSheet,
	TouchableOpacity,
	ViewStyle,
	StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

interface SearchBarProps {
	value: string;
	onChangeText: (text: string) => void;
	placeholder?: string;
	onClear?: () => void;
	style?: StyleProp<ViewStyle>;
	autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
	value,
	onChangeText,
	placeholder = "Search...",
	onClear,
	style,
	autoFocus = false,
}) => {
	const { theme } = useTheme();

	const handleClear = () => {
		onChangeText("");
		if (onClear) {
			onClear();
		}
	};

	return (
		<View
			style={[
				styles.container,
				{ backgroundColor: theme.SearchBar },
				style,
			]}
		>
			<Ionicons
				name="search"
				size={20}
				color={theme.SecondaryText}
				style={styles.searchIcon}
			/>
			<TextInput
				style={[styles.input, { color: theme.PrimaryText }]}
				value={value}
				onChangeText={onChangeText}
				placeholder={placeholder}
				placeholderTextColor={theme.TertiaryText}
				autoFocus={autoFocus}
				autoCapitalize="none"
				autoCorrect={false}
			/>
			{value.length > 0 && (
				<TouchableOpacity
					onPress={handleClear}
					style={styles.clearButton}
				>
					<Ionicons
						name="close-circle"
						size={20}
						color={theme.SecondaryText}
					/>
				</TouchableOpacity>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		alignItems: "center",
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 10,
		height: 44,
	},
	searchIcon: {
		marginRight: 8,
	},
	input: {
		flex: 1,
		fontSize: 16,
		fontWeight: "400",
	},
	clearButton: {
		padding: 4,
		marginLeft: 8,
	},
});
