import styles from "./Sparkline.module.css";

/*
 * Hours per day across the period, as bars.
 *
 * The shape of someone's week is a real signal — five even days reads
 * differently from one fourteen-hour Saturday, and a payroll table that shows
 * only a total hides that. Seven bars in 110px costs nothing and answers it at
 * a glance.
 */
export function Sparkline({
	values,
	labels,
}: {
	/** Seconds per day. */
	values: number[];
	/** Date keys, for the tooltip. */
	labels?: string[];
}) {
	const max = Math.max(...values, 1);

	return (
		<span
			className={styles.wrap}
			role="img"
			aria-label={`${values.filter(Boolean).length} days worked`}
		>
			{values.map((seconds, index) => {
				const hours = seconds / 3600;
				return (
					<span
						key={index}
						className={seconds ? styles.bar : styles.empty}
						style={{
							height: seconds
								? `${Math.max(12, (seconds / max) * 100)}%`
								: undefined,
						}}
						title={
							labels?.[index]
								? `${labels[index]}: ${hours.toFixed(1)}h`
								: `${hours.toFixed(1)}h`
						}
					/>
				);
			})}
		</span>
	);
}
