import React from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { Text } from "../ui/Text";
import AttachmentsSelector from "../ui/AttachmentsSelector";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, BorderRadius, FontSize } from "../../constants/tokens";
import { AttachmentItem } from "../../types";

type NotesAttachmentsSectionProps = {
	notes: string;
	setNotes: (v: string) => void;
	attachments: AttachmentItem[];
	setAttachments: (v: AttachmentItem[]) => void;
	deletionQueue: string[];
	setDeletionQueue: (v: string[]) => void;
	uploadProgress: any;
};

export const NotesAttachmentsSection = ({
	notes,
	setNotes,
	attachments,
	setAttachments,
	deletionQueue,
	setDeletionQueue,
	uploadProgress,
}: NotesAttachmentsSectionProps) => {
	const { theme } = useTheme();

	return (
		<View
			style={[
				styles.section,
				{ borderBottomColor: theme.BorderColor, zIndex: 1 },
			]}
		>
			<Text
				variant="h3"
				weight="bold"
				color="primary"
				style={styles.sectionTitle}
			>
				Additional Information
			</Text>

			<View style={styles.inputContainer}>
				<Text
					variant="body"
					weight="medium"
					color="secondary"
					style={styles.label}
				>
					Notes
				</Text>
				<TextInput
					style={[
						styles.notesInput,
						{
							borderColor: theme.BorderColor,
							backgroundColor: theme.CardBackground,
							color: theme.PrimaryText,
						},
					]}
					placeholder="Add any additional notes about this event"
					placeholderTextColor={theme.TertiaryText}
					multiline={true}
					numberOfLines={4}
					value={notes}
					onChangeText={setNotes}
				/>
			</View>

			<View style={styles.attachmentsContainer}>
				<Text
					variant="body"
					weight="medium"
					color="secondary"
					style={styles.label}
				>
					Attachments
				</Text>
				<AttachmentsSelector
					showDocuments={true}
					showMedia={true}
					attachments={attachments}
					setAttachments={setAttachments}
					deletionQueue={deletionQueue}
					setDeletionQueue={setDeletionQueue}
					uploadProgress={uploadProgress}
				/>
			</View>
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
	notesInput: {
		minHeight: 100,
		borderWidth: 1,
		borderRadius: BorderRadius.md,
		paddingHorizontal: Spacing.lg,
		paddingTop: Spacing.md,
		paddingBottom: Spacing.md,
		fontSize: FontSize.body,
		textAlignVertical: "top",
	},
	attachmentsContainer: {
		marginTop: Spacing.sm,
	},
});
