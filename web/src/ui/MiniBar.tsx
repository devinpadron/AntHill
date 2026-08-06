import styles from "./MiniBar.module.css";

/*
 * A stacked bar for an event's response mix: confirmed / pending / declined.
 *
 * The phone shows these as three numbers, which means reading them one event at
 * a time. As a bar they can be scanned down a column — a month of events tells
 * you at a glance which ones are in trouble, which is the entire reason the
 * calendar list view is worth having.
 *
 * Segment colors are the status tones, not arbitrary: green/amber/red carry the
 * same meaning here as every Badge in the app.
 */
export function MiniBar({
	confirmed = 0,
	pending = 0,
	declined = 0,
	/** Head count the event needs; drives the "short" state. */
	needed,
	width = 56,
}: {
	confirmed?: number;
	pending?: number;
	declined?: number;
	needed?: number;
	width?: number;
}) {
	const answered = confirmed + pending + declined;
	const total = Math.max(answered, needed ?? 0);

	if (total === 0) {
		return (
			<span
				className={styles.empty}
				style={{ width }}
				title="Nobody invited"
			/>
		);
	}

	const pct = (value: number) => `${(value / total) * 100}%`;
	// Anyone needed but not yet invited shows as unfilled track.
	const short = needed ? Math.max(0, needed - confirmed) : 0;

	return (
		<span
			className={styles.bar}
			style={{ width }}
			title={`${confirmed} confirmed · ${pending} pending · ${declined} declined${
				needed ? ` · ${needed} needed` : ""
			}`}
			role="img"
			aria-label={`${confirmed} of ${needed ?? answered} confirmed`}
		>
			{confirmed > 0 && (
				<span
					className={styles.confirmed}
					style={{ width: pct(confirmed) }}
				/>
			)}
			{pending > 0 && (
				<span
					className={styles.pending}
					style={{ width: pct(pending) }}
				/>
			)}
			{declined > 0 && (
				<span
					className={styles.declined}
					style={{ width: pct(declined) }}
				/>
			)}
			{short > 0 && answered < total && (
				<span className={styles.short} style={{ flex: 1 }} />
			)}
		</span>
	);
}
