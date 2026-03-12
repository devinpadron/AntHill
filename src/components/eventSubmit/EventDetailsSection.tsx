import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { Text } from "../ui/Text";
import { LocationInput } from "./LocationInput";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, BorderRadius, FontSize } from "../../constants/tokens";

type Location = {
	[address: string]: {
		latitude: number;
		longitude: number;
		label?: string;
	};
};

type EventDetailsSectionProps = {
	title: string;
	setTitle: (v: string) => void;
	locations: Location | null;
	onLocationSelect: (details: any) => string;
	onLocationDelete: (address: string) => void;
	onLabelChange: (address: string, label: string) => void;
	editingLabelForAddress: string;
	setEditingLabelForAddress: (v: string) => void;
	labelText: string;
	setLabelText: (v: string) => void;
	googlePlacesRef: React.RefObject<any>;
};

export const EventDetailsSection = ({
	title,
	setTitle,
	locations,
	onLocationSelect,
	onLocationDelete,
	onLabelChange,
	editingLabelForAddress,
	setEditingLabelForAddress,
	labelText,
	setLabelText,
	googlePlacesRef,
}: EventDetailsSectionProps) => {
	const { theme } = useTheme();

	return (
		<View
			style={[styles.section, { borderBottomColor: theme.BorderColor }]}
		>
			<Text
				variant="h3"
				weight="bold"
				color="primary"
				style={styles.sectionTitle}
			>
				Event Details
			</Text>
			<View style={styles.inputContainer}>
				<Text
					variant="body"
					weight="medium"
					color="secondary"
					style={styles.label}
				>
					Title
				</Text>
				<TextInput
					style={[
						styles.input,
						{
							borderColor: theme.BorderColor,
							backgroundColor: theme.CardBackground,
							color: theme.PrimaryText,
						},
					]}
					placeholder="Enter Title"
					value={title}
					onChangeText={setTitle}
					placeholderTextColor={theme.TertiaryText}
				/>
			</View>

			<LocationInput
				locations={locations}
				onLocationSelect={onLocationSelect}
				onLocationDelete={onLocationDelete}
				onLabelChange={onLabelChange}
				editingLabelForAddress={editingLabelForAddress}
				setEditingLabelForAddress={setEditingLabelForAddress}
				labelText={labelText}
				setLabelText={setLabelText}
				googlePlacesRef={googlePlacesRef}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	section: {
		padding: Spacing.lg,
		borderBottomWidth: 1,
	},
	sectionTitle: {
		marginBottom: Spacing.lg,
	},
	inputContainer: {
		marginBottom: Spacing.lg,
	},
	label: {
		marginBottom: Spacing.sm,
	},
	input: {
		height: 50,
		borderWidth: 1,
		borderRadius: BorderRadius.md,
		paddingHorizontal: Spacing.lg,
		fontSize: FontSize.body,
	},
});
