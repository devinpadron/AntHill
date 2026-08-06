import React, { useState } from "react";
import { View } from "react-native";
import { Button, Icon, Text } from "../ui";
import { showPrompt } from "../../utils/alertUtils";
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
 * The second button only appears when the company turns on
 * `allowAssignmentDecline`. Flagging never unassigns anyone — a mis-tap must
 * not silently unstaff an event — it raises something for an admin to resolve.
 */
export function AcknowledgeShiftBanner({
	acknowledgement,
	onAcknowledge,
	onFlagProblem,
}: {
	acknowledgement: {
		required: boolean;
		acknowledged: boolean;
		problem: { at: Date | null; note: string | null } | null;
		canFlagProblem: boolean;
	};
	onAcknowledge: () => Promise<void>;
	onFlagProblem: (note: string) => Promise<void>;
}) {
	const theme = useTheme();
	const styles = useThemedStyles(bannerStyles);
	const [busy, setBusy] = useState(false);

	if (!acknowledgement.required) return null;

	/* Already flagged — say so, and let them take it back. */
	if (acknowledgement.problem) {
		return (
			<View style={[styles.banner, styles.problem]}>
				<View style={styles.row}>
					<Icon
						name="alert-circle"
						size="sm"
						color={theme.colors.danger}
					/>
					<Text variant="bodyStrong" color={theme.colors.danger}>
						You said you can&rsquo;t make this
					</Text>
				</View>
				{acknowledgement.problem.note ? (
					<Text variant="caption" color={theme.colors.textSecondary}>
						&ldquo;{acknowledgement.problem.note}&rdquo;
					</Text>
				) : null}
				<Text variant="caption" color={theme.colors.textSecondary}>
					You are still on the crew until a manager changes it.
				</Text>
				<Button
					variant="secondary"
					size="small"
					loading={busy}
					title="Actually, I can work it"
					onPress={async () => {
						setBusy(true);
						try {
							await onAcknowledge();
							toast.success("Thanks — marked as working it");
						} catch {
							toast.error("Could not update that");
						} finally {
							setBusy(false);
						}
					}}
				/>
			</View>
		);
	}

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

			<View style={styles.actions}>
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

				{acknowledgement.canFlagProblem && (
					<Button
						variant="text"
						size="small"
						title="I can't make it"
						onPress={() =>
							/*
							 * A reason is asked for but not required — someone
							 * who cannot work a shift should never be blocked
							 * from saying so by a form.
							 */
							showPrompt(
								"Can't make this shift?",
								"Your manager will see this. You stay on the crew until they change it.",
								[
									{ text: "Cancel", style: "cancel" },
									{
										text: "Send",
										style: "destructive",
										onPress: (note) => {
											void (async () => {
												setBusy(true);
												try {
													await onFlagProblem(
														note ?? "",
													);
													toast.success(
														"Your manager has been told",
													);
												} catch {
													toast.error(
														"Could not send that",
													);
												} finally {
													setBusy(false);
												}
											})();
										},
									},
								],
							)
						}
					/>
				)}
			</View>
		</View>
	);
}

const bannerStyles = (theme: Theme) => ({
	banner: {
		borderRadius: theme.radius.md,
		padding: theme.spacing.md,
		gap: theme.spacing.xs,
		marginBottom: theme.spacing.lg,
	},
	pending: {
		backgroundColor: theme.colors.warningSubtle,
	},
	done: {
		backgroundColor: theme.colors.successSubtle,
	},
	problem: {
		backgroundColor: theme.colors.dangerSubtle,
	},
	row: {
		flexDirection: "row" as const,
		alignItems: "center" as const,
		gap: theme.spacing.sm,
	},
	actions: {
		flexDirection: "row" as const,
		alignItems: "center" as const,
		gap: theme.spacing.sm,
		marginTop: theme.spacing.xs,
	},
});
