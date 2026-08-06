import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import { Text } from "../ui";
import { toast } from "../ui/Toast";
import { FormField } from "../../types";
import { Theme, useTheme, useThemedStyles } from "../../theme";

/*
 * A form answer an admin edits in place.
 *
 * Replaces the tap-a-pencil, type, tap-a-tick flow. That was three taps for one
 * number, and it was gated behind `quickEditPayroll` — so a manager reviewing
 * payroll could correct one figure and not the one beside it, for a reason that
 * was invisible on screen. Every field an admin may change is now simply
 * editable.
 *
 * SAVES ON BLUR. There is no confirm button: the field commits when it loses
 * focus, which on a phone means tapping anywhere else. Saving per keystroke
 * would mean a write and an edit-history entry per character, and that history
 * is the record of who changed what.
 *
 * Only numeric and text fields are handled here. Checklists, files and
 * selections need pickers rather than a keyboard, and go on being rendered
 * read-only by FormFieldValue — editing those is what the edit sheet is for.
 */
export function QuickField({
	field,
	value,
	onSave,
}: {
	field: FormField;
	value: unknown;
	/** Rejecting reverts the input to the last committed value. */
	onSave: (next: string | number | null) => Promise<void>;
}) {
	const theme = useTheme();
	const styles = useThemedStyles(quickFieldStyles);

	const initial = value === null || value === undefined ? "" : String(value);
	const [draft, setDraft] = useState(initial);
	const [saving, setSaving] = useState(false);
	const committed = useRef(initial);

	/*
	 * Re-seed when the entry reloads underneath — but never while the admin is
	 * mid-edit, which would erase what they are typing. After a save the parent
	 * refetches, so this is the path that accepts the server's value.
	 */
	useEffect(() => {
		if (draft === committed.current) {
			setDraft(initial);
			committed.current = initial;
		}
	}, [initial]);

	const numeric =
		field.type === "number" ||
		field.type === "currency" ||
		field.type === "quantity";

	async function commit() {
		const next = draft.trim();
		if (next === committed.current) return;

		if (numeric && next !== "" && Number.isNaN(Number(next))) {
			toast.error("That is not a number", "The change was not saved.");
			setDraft(committed.current);
			return;
		}

		setSaving(true);
		try {
			await onSave(numeric ? (next === "" ? null : Number(next)) : next);
			committed.current = next;
		} catch (error) {
			toast.error(
				"Could not save that",
				error instanceof Error ? error.message : undefined,
			);
			setDraft(committed.current);
		} finally {
			setSaving(false);
		}
	}

	const dirty = draft.trim() !== committed.current;

	return (
		<View style={styles.row}>
			<TextInput
				style={[styles.input, dirty && styles.inputDirty]}
				value={draft}
				onChangeText={setDraft}
				onBlur={commit}
				editable={!saving}
				keyboardType={numeric ? "decimal-pad" : "default"}
				placeholder={field.placeholder}
				placeholderTextColor={theme.colors.textTertiary}
				// Committing on submit as well, so the keyboard's done key
				// behaves the way a phone user expects.
				returnKeyType="done"
				onSubmitEditing={commit}
				accessibilityLabel={field.label}
			/>

			{field.unit ? (
				<Text variant="caption" color="textTertiary">
					{field.unit}
				</Text>
			) : null}

			{saving ? (
				<ActivityIndicator size="small" color={theme.colors.accent} />
			) : dirty ? (
				<Text variant="caption" color="textTertiary">
					unsaved
				</Text>
			) : null}
		</View>
	);
}

const quickFieldStyles = (theme: Theme) => ({
	row: {
		flexDirection: "row" as const,
		alignItems: "center" as const,
		gap: theme.spacing.sm,
		flex: 1,
	},
	input: {
		flex: 1,
		minHeight: theme.hitTarget,
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.sm,
		backgroundColor: theme.colors.surfaceSunken,
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		color: theme.colors.text,
		fontSize: theme.type.body.fontSize,
	},
	/* What is on screen is not yet what is in the database. */
	inputDirty: {
		borderColor: theme.colors.warning,
		backgroundColor: theme.colors.warningSubtle,
	},
});
