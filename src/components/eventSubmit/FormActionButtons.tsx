import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "../ui/Button";
import { Spacing, IconSize } from "../../constants/tokens";

type FormActionButtonsProps = {
	isEditing: boolean;
	isLoading: boolean;
	isUploading: boolean;
	canSubmit: boolean;
	onSubmit: () => void;
	onDelete: () => void;
};

export const FormActionButtons = ({
	isEditing,
	isLoading,
	isUploading,
	canSubmit,
	onSubmit,
	onDelete,
}: FormActionButtonsProps) => {
	return (
		<View style={styles.container}>
			<Button
				title={isEditing ? "Update Event" : "Create Event"}
				onPress={onSubmit}
				variant="primary"
				fullWidth
				loading={isLoading || isUploading}
				disabled={(isEditing && !canSubmit) || isUploading || isLoading}
				icon={<Ionicons name="send" size={IconSize.md} color="white" />}
				style={styles.submitButton}
			/>

			{isEditing && (
				<Button
					title="Delete Event"
					onPress={onDelete}
					variant="destructive"
					fullWidth
					icon={
						<Ionicons
							name="trash-outline"
							size={IconSize.md}
							color="white"
						/>
					}
				/>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		marginTop: Spacing.sm,
		marginBottom: Spacing.xxl,
	},
	submitButton: {
		marginBottom: Spacing.md,
	},
});
