import React from "react";
import { View } from "react-native";
import { Icon, Text } from "../ui";
import { Theme, useTheme, useThemedStyles } from "../../theme";

/*
 * "Someone on this crew says they can't make it."
 *
 * Flagging a problem deliberately does NOT unassign anyone — a mis-tap must
 * never silently unstaff a job — so the assignment list still reads as full and
 * the event looks exactly as it did before. Without this the only trace is a
 * field on a response document nobody opens, and the first anyone knows is a
 * crew member who does not turn up.
 *
 * Managers only. A worker seeing "3 of 5 have flagged a problem" learns
 * something about their colleagues that is not theirs to know, and can do
 * nothing about it; their own flag is already shown to them by
 * AcknowledgeShiftBanner.
 */
export function ShortStaffedBanner({
	problems,
	assignedCount,
}: {
	problems: { userId: string; name: string; note: string | null }[];
	assignedCount: number;
}) {
	const theme = useTheme();
	const styles = useThemedStyles(bannerStyles);

	if (problems.length === 0) return null;

	/*
	 * Stated as a shortfall rather than a count of flags, because that is the
	 * decision being made: not "two people complained" but "you may be running
	 * this job with three".
	 */
	const remaining = Math.max(0, assignedCount - problems.length);

	return (
		<View style={styles.banner}>
			<View style={styles.row}>
				<Icon name="warning" size="sm" color={theme.colors.warning} />
				<Text variant="bodyStrong" color={theme.colors.warning}>
					{problems.length === 1
						? "1 person can't make this"
						: `${problems.length} people can't make this`}
				</Text>
			</View>

			<Text variant="caption" color={theme.colors.textSecondary}>
				{remaining === 0
					? "Nobody on the crew has confirmed they can work it."
					: `You may be down to ${remaining} of ${assignedCount}. They are still assigned — remove or replace them yourself.`}
			</Text>

			<View style={styles.list}>
				{problems.map((problem) => (
					<View key={problem.userId} style={styles.person}>
						<Text variant="label">{problem.name}</Text>
						{problem.note ? (
							<Text
								variant="caption"
								color={theme.colors.textSecondary}
							>
								{`“${problem.note}”`}
							</Text>
						) : (
							<Text
								variant="caption"
								color={theme.colors.textTertiary}
							>
								No reason given
							</Text>
						)}
					</View>
				))}
			</View>
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
		backgroundColor: theme.colors.warningSubtle,
		borderWidth: theme.hairlineWidth,
		borderColor: theme.colors.warning,
	},
	row: {
		flexDirection: "row" as const,
		alignItems: "center" as const,
		gap: theme.spacing.sm,
	},
	list: {
		gap: theme.spacing.sm,
		marginTop: theme.spacing.xs,
	},
	person: {
		gap: 2,
	},
});
