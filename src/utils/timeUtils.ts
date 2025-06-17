export const formatDuration = (seconds: number): string => {
	if (!seconds) return "0h 0m";

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
};

export const calculateMultipliedValue = (
	value: any,
	multiplier: number,
): string | null => {
	if (!value || !multiplier) return null;

	const numValue = parseFloat(value);
	if (isNaN(numValue)) return null;

	const result = numValue * multiplier;
	return result % 1 !== 0 ? result.toFixed(2) : result.toString();
};

export const getStatusBadgeColor = (status: string): string => {
	switch (status) {
		case "approved":
			return "#d4edda"; // Green
		case "pending_approval":
			return "#fff3cd"; // Orange
		case "edited":
			return "#cce5ff"; // Yellow
		case "active":
			return "#d1ecf1"; // Blue
		case "paused":
			return "#fff3cd"; // Orange
		case "rejected":
			return "#f8d7da"; // Red
		default:
			return "#f8d7da"; // Grey
	}
};

export const getStatusBadgeText = (status: string): string => {
	switch (status) {
		case "approved":
			return "Approved";
		case "pending_approval":
			return "Pending Approval";
		case "edited":
			return "Edited";
		case "active":
			return "Active";
		case "paused":
			return "Paused";
		case "rejected":
			return "Rejected";
		default:
			return "Not Submitted";
	}
};

export const calculateFieldTotals = (entries) => {
	// Initialize an empty totals object
	const totals = {};

	if (!entries || entries.length === 0) {
		return totals;
	}

	// Process each time entry using its own form structure
	entries.forEach((entry) => {
		// Use the form structure attached to the entry
		const entryForm = entry.generalForm || null;

		if (entryForm && entryForm.fields) {
			// Find fields that have showTotal enabled
			const fieldsToTotal = entryForm.fields.filter(
				(field) =>
					field.showTotal === true &&
					(field.type === "number" ||
						field.type === "currency" ||
						field.type === "quantity"),
			);

			// Process fields for this entry
			fieldsToTotal.forEach((field) => {
				// Initialize field in totals if not already there
				if (!totals[`te_${field.id}`]) {
					totals[`te_${field.id}`] = {
						label: field.label,
						total: 0,
						unit: field.unit || "",
						useMultiplier: field.useMultiplier || false,
						multiplier: field.multiplier || 1,
						type: field.type,
						source: "timeEntry",
					};
				}

				// Add this entry's value to the total
				const value = entry.formResponses?.[field.id];
				if (value !== undefined && value !== null) {
					const numValue = parseFloat(value);
					if (!isNaN(numValue)) {
						totals[`te_${field.id}`].total += numValue;

						// Store the raw total before multiplier is applied
						totals[`te_${field.id}`].rawTotal =
							totals[`te_${field.id}`].total;

						// Calculate multiplied value if needed
						if (field.useMultiplier && field.multiplier) {
							totals[`te_${field.id}`].multipliedTotal =
								totals[`te_${field.id}`].total *
								field.multiplier;
						}
					}
				}
			});
		}

		// Process connected events using their own form structures
		if (entry.connectedEvents && entry.connectedEvents.length > 0) {
			entry.connectedEvents.forEach((connection) => {
				// Use the form structure attached to the event connection
				const eventForm = entry.eventForm || null;

				if (eventForm && eventForm.fields) {
					const eventFieldsToTotal = eventForm.fields.filter(
						(field) =>
							field.showTotal === true &&
							(field.type === "number" ||
								field.type === "currency" ||
								field.type === "quantity"),
					);

					eventFieldsToTotal.forEach((field) => {
						// Initialize field in totals if not already there
						const fieldKey = `ev_${field.id}`;
						if (!totals[fieldKey]) {
							totals[fieldKey] = {
								label: `${field.label} (Events)`,
								total: 0,
								unit: field.unit || "",
								useMultiplier: field.useMultiplier || false,
								multiplier: field.multiplier || 1,
								type: field.type,
								source: "event",
							};
						}

						// Add this event's value to the total
						const value = connection.formResponses?.[field.id];
						if (value !== undefined && value !== null) {
							const numValue = parseFloat(value);
							if (!isNaN(numValue)) {
								totals[fieldKey].total += numValue;
								totals[fieldKey].rawTotal =
									totals[fieldKey].total;

								if (field.useMultiplier && field.multiplier) {
									totals[fieldKey].multipliedTotal =
										totals[fieldKey].total *
										field.multiplier;
								}
							}
						}
					});
				}
			});
		}
	});

	return totals;
};
