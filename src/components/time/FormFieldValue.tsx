import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { format } from "date-fns";
import AttachmentGallery from "../ui/AttachmentGallery";
import {
	calculateMultipliedValue,
	checklistCheckedSet,
} from "../../utils/timeUtils";
import { useUser } from "../../contexts/UserContext";
import { getChecklistsByIds } from "../../services/libraryService";
import { Icon, Text } from "../ui";
import { Theme, useThemedStyles } from "../../theme";

/**
 * Renders one submitted value from a company-defined form.
 *
 * Read-only counterpart to `CustomFormRender`: the schema decides what a field
 * is, and this decides how its answer reads back.
 */
const FormFieldValue = ({ field, response, attachments = [] }) => {
	const styles = useThemedStyles(valueStyles);
	const { companyId } = useUser();
	const [checklistItems, setChecklistItems] = useState<
		{ id?: string; text: string }[]
	>([]);

	useEffect(() => {
		const loadChecklistItems = async () => {
			if (field?.type !== "checklist") return;
			if (!companyId || !field?.checklistId) return;

			/*
			 * v1 preferred a legacy inline `field.options` and fell back to a
			 * Firestore read. v2 has no inline options — the migration turned
			 * every one into a real checklist document and rewrote the field to
			 * a checklistId — so there is a single path here.
			 */
			const byId = await getChecklistsByIds(companyId, [
				field.checklistId,
			]);
			const checklist = byId[field.checklistId];

			/*
			 * Both halves are kept. The response may identify a ticked item by
			 * either its text or its id depending on when it was written, so
			 * matching needs both.
			 */
			setChecklistItems(
				(checklist?.items ?? []).filter(
					(item) => item?.text && item.text.trim().length > 0,
				),
			);
		};

		loadChecklistItems();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [companyId, field?.checklistId]);

	const empty = (
		<Text variant="body" color="textTertiary">
			—
		</Text>
	);

	if (field.type === "number" && field.useMultiplier && field.multiplier) {
		return (
			<View>
				<Text variant="body">{response}</Text>
				<Text variant="caption" color="accent">
					{calculateMultipliedValue(response, field.multiplier)}{" "}
					{field.unit || ""}
				</Text>
			</View>
		);
	}

	if (field.type === "checkbox") {
		return (
			<View style={styles.inlineRow}>
				<Icon
					name={response ? "checkmark-circle" : "close-circle"}
					size="sm"
					color={response ? "success" : "textTertiary"}
				/>
				<Text variant="body">{response ? "Yes" : "No"}</Text>
			</View>
		);
	}

	if (field.type === "checklist") {
		const checked = checklistCheckedSet(response);

		const isChecked = (item: { id?: string; text: string }) =>
			(!!item.id && checked.has(item.id)) || checked.has(item.text);

		/*
		 * No master list — the checklist document was deleted, or the field
		 * carries no checklistId. Show what WAS ticked, still ticked, rather
		 * than a comma-separated line that says nothing about state.
		 */
		const items: { id?: string; text: string }[] = checklistItems.length
			? checklistItems
			: [...checked].map((text) => ({ text }));

		if (!items.length) return empty;

		const doneCount = items.filter(isChecked).length;

		return (
			<View style={styles.checklist}>
				<Text variant="caption" color="textSecondary">
					{doneCount} of {items.length} complete
				</Text>

				{items.map((item, index) => {
					const done = isChecked(item);

					return (
						<View
							key={item.id ?? index}
							style={styles.checklistItem}
						>
							<Icon
								name={done ? "checkbox" : "square-outline"}
								size="sm"
								color={done ? "success" : "textTertiary"}
							/>
							<Text
								variant="body"
								color={done ? "text" : "textTertiary"}
								style={[styles.flex, done && styles.done]}
							>
								{item.text}
							</Text>
						</View>
					);
				})}
			</View>
		);
	}

	if (field.type === "multiSelect") {
		return Array.isArray(response) && response.length > 0 ? (
			<Text variant="body">{response.join(", ")}</Text>
		) : (
			empty
		);
	}

	if (field.type === "date" && response) {
		return (
			<Text variant="body">
				{format(new Date(response), "MMM d, yyyy")}
			</Text>
		);
	}

	if (field.type === "time" && response) {
		return (
			<Text variant="body">{format(new Date(response), "h:mm a")}</Text>
		);
	}

	if ((field.type === "document" || field.type === "media") && response) {
		return Array.isArray(response) && response.length > 0 ? (
			<AttachmentGallery attachments={attachments} />
		) : (
			<Text variant="body" color="textTertiary">
				No files uploaded
			</Text>
		);
	}

	return response ? <Text variant="body">{response}</Text> : empty;
};

export default FormFieldValue;

const valueStyles = (theme: Theme) =>
	StyleSheet.create({
		flex: {
			flex: 1,
		},
		inlineRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.sm,
		},
		checklist: {
			gap: theme.spacing.sm,
			marginTop: theme.spacing.xs,
		},
		done: {
			/* Reads as struck off a list rather than merely dimmed. */
			textDecorationLine: "line-through",
		},
		checklistItem: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.sm,
		},
	});
