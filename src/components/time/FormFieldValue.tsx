import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { format } from "date-fns";
import AttachmentGallery from "../ui/AttachmentGallery";
import { calculateMultipliedValue } from "../../utils/timeUtils";

const FormFieldValue = ({ field, response, attachments = [] }) => {
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
});

export default FormFieldValue;
