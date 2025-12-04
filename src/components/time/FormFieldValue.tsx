import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { format } from "date-fns";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AttachmentGallery from "../ui/AttachmentGallery";
import { calculateMultipliedValue } from "../../utils/timeUtils";
import db from "../../constants/firestore";
import { useUser } from "../../contexts/UserContext";

const FormFieldValue = ({ field, response, attachments = [] }) => {
	const { companyId } = useUser();
	const [checklistItems, setChecklistItems] = useState<string[]>([]);

	useEffect(() => {
		const loadChecklistItems = async () => {
			if (field?.type !== "checklist") return;
			// Prefer field.options if present (legacy), else fetch from Firestore using checklistId
			if (Array.isArray(field?.options) && field.options.length > 0) {
				setChecklistItems(field.options);
				return;
			}
			if (!companyId || !field?.checklistId) return;
			try {
				const snap = await db
					.collection("Companies")
					.doc(companyId)
					.collection("Checklists")
					.doc(field.checklistId)
					.get();
				const data =
					typeof snap?.data === "function" ? snap.data() : undefined;
				const rawItems = Array.isArray(data?.items)
					? (data.items as any[])
					: [];
				const items = rawItems
					.map((it: any) => (typeof it === "string" ? it : it?.text))
					.filter(
						(t: any) =>
							typeof t === "string" && t.trim().length > 0,
					);
				setChecklistItems(items);
			} catch (e) {
				setChecklistItems([]);
				console.warn(
					"Failed to load checklist items for details view:",
					e,
				);
			}
		};
		loadChecklistItems();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [companyId, field?.checklistId]);
	if (field.type === "number" && field.useMultiplier && field.multiplier) {
		return (
			<View>
				<Text style={styles.formFieldValue}>{response} </Text>
				<Text style={styles.multiplierValue}>
					({calculateMultipliedValue(response, field.multiplier)}{" "}
					{field.unit || ""})
				</Text>
			</View>
		);
	} else if (field.type === "checkbox") {
		return (
			<Text style={styles.formFieldValue}>{response ? "Yes" : "No"}</Text>
		);
	} else if (field.type === "checklist") {
		const checkedItems = Array.isArray(response) ? response : [];
		const allItems = checklistItems;

		if (!allItems || allItems.length === 0) {
			// If no master list, show checked items as a simple list
			return (
				<Text style={styles.formFieldValue}>
					{checkedItems.length > 0 ? checkedItems.join(", ") : "N/A"}
				</Text>
			);
		}

		return (
			<View style={styles.checklistContainer}>
				{allItems.map((item, index) => {
					const isChecked = checkedItems.includes(item);
					return (
						<View key={index} style={styles.checklistItem}>
							<Icon
								name={
									isChecked
										? "check-circle"
										: "circle-outline"
								}
								size={20}
								color={isChecked ? "#34c759" : "#ccc"}
							/>
							<Text
								style={[
									styles.checklistItemText,
									isChecked &&
										styles.checklistItemTextChecked,
								]}
							>
								{item}
							</Text>
						</View>
					);
				})}
			</View>
		);
	} else if (field.type === "multiSelect") {
		return (
			<Text style={styles.formFieldValue}>
				{Array.isArray(response) && response.length > 0
					? response.join(", ")
					: "N/A"}
			</Text>
		);
	} else if (field.type === "date" && response) {
		return (
			<Text style={styles.formFieldValue}>
				{format(new Date(response), "MMM d, yyyy")}
			</Text>
		);
	} else if (field.type === "time" && response) {
		return (
			<Text style={styles.formFieldValue}>
				{format(new Date(response), "h:mm a")}
			</Text>
		);
	} else if (
		(field.type === "document" || field.type === "media") &&
		response
	) {
		return (
			<View>
				{Array.isArray(response) && response.length > 0 ? (
					<AttachmentGallery attachments={attachments} />
				) : (
					<Text style={styles.formFieldValue}>No files uploaded</Text>
				)}
			</View>
		);
	} else {
		return (
			<Text style={styles.formFieldValue}>
				{response ? response : "N/A"}
			</Text>
		);
	}
};

const styles = StyleSheet.create({
	formFieldValue: {
		fontSize: 15,
		color: "#333",
	},
	multiplierValue: {
		fontSize: 14,
		color: "#007AFF",
	},
	checklistContainer: {
		gap: 8,
		marginTop: 4,
	},
	checklistItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 2,
	},
	checklistItemText: {
		fontSize: 15,
		color: "#666",
		marginLeft: 8,
		flex: 1,
	},
	checklistItemTextChecked: {
		color: "#333",
		fontWeight: "500",
	},
});

export default FormFieldValue;
