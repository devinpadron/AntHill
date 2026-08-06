import React from "react";
import { StyleSheet, View } from "react-native";
import { FieldTotal } from "../../utils/timeUtils";
import { Card, Text } from "../ui";
import { Theme, useThemedStyles } from "../../theme";

/**
 * Totals across a company's custom form fields.
 *
 * Split by where the field came from — the timesheet form or the event form —
 * because the same label can legitimately appear in both and summing them
 * together would be wrong.
 */

type FieldTotalsCardProps = {
	fieldTotals: Record<string, FieldTotal>;
};

const TotalRow = ({ data }: { data: FieldTotal }) => {
	const styles = useThemedStyles(totalsStyles);

	return (
		<View style={styles.row}>
			<Text variant="body" color="textSecondary" style={styles.flex}>
				{data.label}
			</Text>
			<View style={styles.values}>
				<Text variant="bodyStrong">
					{data.total.toFixed(2)} {data.unit}
				</Text>
				{/* The multiplied figure is what payroll bills against. */}
				{data.useMultiplier && data.multipliedTotal !== undefined && (
					<Text variant="caption" color="accent">
						{data.multipliedTotal.toFixed(2)} {data.unit} billed
					</Text>
				)}
			</View>
		</View>
	);
};

const FieldTotalsCard = ({ fieldTotals }: FieldTotalsCardProps) => {
	const styles = useThemedStyles(totalsStyles);

	if (!fieldTotals || Object.keys(fieldTotals).length === 0) {
		return null;
	}

	const timeEntryTotals: [string, FieldTotal][] = [];
	const eventTotals: [string, FieldTotal][] = [];

	Object.entries(fieldTotals).forEach(([key, data]) => {
		(data.source === "event" ? eventTotals : timeEntryTotals).push([
			key,
			data,
		]);
	});

	return (
		<Card title="Form totals" style={styles.card}>
			{timeEntryTotals.length > 0 && (
				<>
					<Text
						variant="label"
						color="textSecondary"
						uppercase
						style={styles.section}
					>
						Timesheet
					</Text>
					{timeEntryTotals.map(([fieldId, data]) => (
						<TotalRow key={fieldId} data={data} />
					))}
				</>
			)}

			{eventTotals.length > 0 && (
				<>
					<Text
						variant="label"
						color="textSecondary"
						uppercase
						style={styles.section}
					>
						Events
					</Text>
					{eventTotals.map(([fieldId, data]) => (
						<TotalRow key={fieldId} data={data} />
					))}
				</>
			)}
		</Card>
	);
};

export default FieldTotalsCard;

const totalsStyles = (theme: Theme) =>
	StyleSheet.create({
		flex: {
			flex: 1,
		},
		card: {
			marginHorizontal: theme.spacing.lg,
			marginBottom: theme.spacing.lg,
		},
		section: {
			marginTop: theme.spacing.sm,
			marginBottom: theme.spacing.xs,
		},
		row: {
			flexDirection: "row",
			alignItems: "flex-start",
			justifyContent: "space-between",
			gap: theme.spacing.md,
			paddingVertical: theme.spacing.sm,
			borderBottomWidth: theme.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		values: {
			alignItems: "flex-end",
		},
	});
