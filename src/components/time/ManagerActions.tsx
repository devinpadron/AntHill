import React from "react";
import { StyleSheet, View } from "react-native";
import { Badge, Button, Card, Checkbox } from "../ui";
import { Theme, useThemedStyles } from "../../theme";

/**
 * The manager's bulk bar over a set of time entries.
 *
 * Approve is the primary action and keeps the accent; reject is destructive and
 * email is secondary — previously all three were equally loud filled buttons in
 * three unrelated colors (`#34C759`, `#007AFF`, `#FF3B30`).
 */

interface ManagerActionsProps {
	selectAll: boolean;
	toggleSelectAll: () => void;
	selectedCount: number;
	totalCount: number;
	isApproving: boolean;
	onApprove: () => Promise<void>;
	onReject: () => Promise<void>;
	onEmail?: () => Promise<void>;
	showEmailOption?: boolean;
}

const ManagerActions = ({
	selectAll,
	toggleSelectAll,
	selectedCount,
	totalCount,
	isApproving,
	onApprove,
	onReject,
	onEmail,
	showEmailOption = false,
}: ManagerActionsProps) => {
	const styles = useThemedStyles(managerStyles);
	const hasSelection = selectedCount > 0;

	return (
		<Card style={styles.card}>
			<View style={styles.selectRow}>
				{/*
				 * The checkbox takes the slack and the badge holds its width.
				 * Without both, `Checkbox`'s own flex:1 label pushed the badge
				 * past the card's right edge.
				 */}
				<Checkbox
					checked={selectAll}
					onPress={toggleSelectAll}
					label={selectAll ? "Deselect all" : "Select all"}
					style={styles.flex}
				/>
				<Badge
					label={`${selectedCount} of ${totalCount}`}
					tone={hasSelection ? "accent" : "neutral"}
					style={styles.count}
				/>
			</View>

			<View style={styles.actions}>
				<Button
					title="Approve"
					icon="checkmark"
					onPress={onApprove}
					disabled={!hasSelection || isApproving}
					loading={isApproving}
					haptic="success"
					style={styles.flex}
				/>

				{showEmailOption && (
					<Button
						title="Email"
						icon="mail-outline"
						variant="secondary"
						onPress={onEmail}
						disabled={!hasSelection || isApproving}
						style={styles.flex}
					/>
				)}

				<Button
					title="Reject"
					icon="close"
					variant="destructive"
					onPress={onReject}
					disabled={!hasSelection || isApproving}
					haptic="press"
					style={styles.flex}
				/>
			</View>
		</Card>
	);
};

export default ManagerActions;

const managerStyles = (theme: Theme) =>
	StyleSheet.create({
		flex: {
			flex: 1,
		},
		card: {
			marginHorizontal: theme.spacing.lg,
			marginBottom: theme.spacing.lg,
		},
		selectRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.md,
			marginBottom: theme.spacing.md,
		},
		count: {
			flexShrink: 0,
		},
		actions: {
			flexDirection: "row",
			gap: theme.spacing.sm,
		},
	});
