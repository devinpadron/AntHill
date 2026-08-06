import React, { useState } from "react";
import { View } from "react-native";
import { Button, Icon, Text } from "../ui";
import { toast } from "../ui/Toast";
import { Theme, useTheme, useThemedStyles } from "../../theme";

/*
 * "You are working this — confirm you have seen it."
 *
 * Assignment is a statement, not a question: a manager adds someone to a crew
 * and the event simply appears in their list. Nothing previously required the
 * worker to register that, so a shift could land in someone's week unnoticed
 * until the morning it started.
 *
 * This is deliberately NOT the availability control that sits elsewhere on the
 * screen. That one answers "can you work this?" before assignment; this one
 * answers "I know I am working this" after. A worker can have confirmed
 * availability weeks ago and still not have seen that the shift became real.
 *
 * Confirming is the ONLY answer. There was briefly a second button for saying
 * you could not make it, which raised a flag for a manager without unassigning
 * anyone; it is gone. A shift you cannot work is a conversation with your
 * manager, not a form — and a flag that left the crew list looking full was a
 * quiet way for a job to end up short.
 *
 * Shown only when the company requires confirmation
 * (`requireAssignmentAcknowledgement`); `required` carries that decision.
 */
export function AcknowledgeShiftBanner({
	acknowledgement,
	onAcknowledge,
}: {
	acknowledgement: {
		required: boolean;
		acknowledged: boolean;
	};
	onAcknowledge: () => Promise<void>;
}) {
	const theme = useTheme();
	const styles = useThemedStyles(bannerStyles);
	const [busy, setBusy] = useState(false);

	if (!acknowledgement.required) return null;

	/* Confirmed — a quiet receipt, not a call to action. */
	if (acknowledgement.acknowledged) {
		return (
			<View style={[styles.banner, styles.done]}>
				<View style={styles.row}>
					<Icon
						name="checkmark-circle"
						size="sm"
						color={theme.colors.success}
					/>
					<Text variant="caption" color={theme.colors.success}>
						You&rsquo;ve confirmed you&rsquo;re working this
					</Text>
				</View>
			</View>
		);
	}

	return (
		<View style={[styles.banner, styles.pending]}>
			<View style={styles.row}>
				<Icon name="warning" size="sm" color={theme.colors.warning} />
				<Text variant="bodyStrong">You&rsquo;re working this</Text>
			</View>
			<Text variant="caption" color={theme.colors.textSecondary}>
				Let your manager know you&rsquo;ve seen it.
			</Text>

			<Button
				variant="primary"
				size="small"
				loading={busy}
				title="Got it"
				onPress={async () => {
					setBusy(true);
					try {
						await onAcknowledge();
						toast.success("Confirmed — thanks");
					} catch {
						toast.error("Could not confirm", "Try again.");
					} finally {
						setBusy(false);
					}
				}}
			/>
		</View>
	);
}

const bannerStyles = (theme: Theme) => ({
	banner: {
		gap: theme.spacing.sm,
		padding: theme.spacing.lg,
		marginHorizontal: theme.spacing.lg,
		marginTop: theme.spacing.lg,
		borderRadius: theme.radius.md,
		borderWidth: theme.hairlineWidth,
	},
	pending: {
		backgroundColor: theme.colors.warningSubtle,
		borderColor: theme.colors.warning,
	},
	done: {
		backgroundColor: theme.colors.successSubtle,
		borderColor: "transparent",
	},
	row: {
		flexDirection: "row" as const,
		alignItems: "center" as const,
		gap: theme.spacing.sm,
	},
});
