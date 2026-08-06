import { useNavigate, useParams } from "react-router-dom";
import { formatDuration } from "@app/utils/timeUtils";
import type { Membership, TimeEntry } from "@app/types";
import { Badge, Card, Icon, Text } from "../../ui";
import { netSecondsOf } from "./usePayroll";
import styles from "./AttentionRail.module.css";

/*
 * The things worth chasing before running payroll.
 *
 * Every one of these is derivable from data the app already has, and none of
 * them are visible there — a phone has no room for a panel whose whole job is
 * "here is what looks wrong". That absence is why a shift left running for
 * three days gets found at month end rather than the next morning.
 *
 * Shown in place of the entry detail when no employee is selected, so it costs
 * no screen space and is never in the way.
 */

export type Attention = {
	stillRunning: TimeEntry[];
	stuckPaused: TimeEntry[];
	untrustedReview: TimeEntry[];
	edited: TimeEntry[];
	noEntries: Membership[];
};

export function AttentionRail({ attention }: { attention: Attention }) {
	const navigate = useNavigate();
	const { companyId } = useParams<{ companyId: string }>();

	const open = (entryId: string) =>
		navigate(`/${companyId}/payroll/entries/${entryId}`);

	const groups = [
		{
			key: "running",
			tone: "danger" as const,
			icon: "time-outline" as const,
			title: "Still running after 12 hours",
			hint: "Almost certainly a forgotten clock-out.",
			entries: attention.stillRunning,
		},
		{
			key: "paused",
			tone: "warning" as const,
			icon: "warning" as const,
			title: "Paused and left",
			hint: "A pause that was never resumed keeps counting as paused.",
			entries: attention.stuckPaused,
		},
		{
			key: "provenance",
			tone: "warning" as const,
			icon: "help-circle-outline" as const,
			title: "Approver not recorded",
			hint: "Approved before the review record existed — the name shown is inferred.",
			entries: attention.untrustedReview,
		},
		{
			key: "edited",
			tone: "neutral" as const,
			icon: "pencil" as const,
			title: "Edited this period",
			hint: "Changed after submission. The history is on each entry.",
			entries: attention.edited,
		},
	].filter((group) => group.entries.length > 0);

	const nothingWrong = groups.length === 0 && !attention.noEntries.length;

	return (
		<Card title="Needs attention" className={styles.card} flush={false}>
			{nothingWrong ? (
				<div className={styles.clear}>
					<Icon name="checkmark-circle" size="lg" />
					<Text variant="body" tone="secondary">
						Nothing looks wrong in this period.
					</Text>
				</div>
			) : (
				<div className={styles.groups}>
					{groups.map((group) => (
						<section key={group.key} className={styles.group}>
							<div className={styles.groupHead}>
								<Icon
									name={group.icon}
									size="sm"
									className={styles[group.tone]}
								/>
								<Text variant="bodyStrong" as="span">
									{group.title}
								</Text>
								<Badge tone={group.tone}>
									{group.entries.length}
								</Badge>
							</div>
							<Text variant="caption" tone="tertiary">
								{group.hint}
							</Text>
							<ul className={styles.list}>
								{group.entries.slice(0, 5).map((entry) => (
									<li key={entry.id}>
										<button
											className={styles.row}
											onClick={() => open(entry.id)}
										>
											<Text
												variant="caption"
												as="span"
												clamp={1}
											>
												{entry.dateKey}
											</Text>
											<Text
												variant="caption"
												tone="tertiary"
												as="span"
											>
												{formatDuration(
													netSecondsOf(entry),
												)}
											</Text>
											<Icon
												name="chevron-forward"
												size="xs"
											/>
										</button>
									</li>
								))}
								{group.entries.length > 5 && (
									<li className={styles.more}>
										<Text variant="caption" tone="tertiary">
											+{group.entries.length - 5} more
										</Text>
									</li>
								)}
							</ul>
						</section>
					))}

					{attention.noEntries.length > 0 && (
						<section className={styles.group}>
							<div className={styles.groupHead}>
								<Icon
									name="person-outline"
									size="sm"
									className={styles.neutral}
								/>
								<Text variant="bodyStrong" as="span">
									No hours this period
								</Text>
								<Badge tone="neutral">
									{attention.noEntries.length}
								</Badge>
							</div>
							<Text variant="caption" tone="tertiary">
								{attention.noEntries
									.slice(0, 8)
									.map((m) => m.firstName)
									.join(", ")}
								{attention.noEntries.length > 8 &&
									` +${attention.noEntries.length - 8}`}
							</Text>
						</section>
					)}
				</div>
			)}
		</Card>
	);
}
