import styles from "./Spinner.module.css";

/*
 * The app's Loading primitive always tints the spinner with the accent color;
 * this keeps that, but defaults to currentColor so it can also sit inside a
 * filled button where accent-on-accent would be invisible.
 */
export function Spinner({
	size = 22,
	color = "currentColor",
	label,
}: {
	size?: number;
	color?: string;
	/** Announced to assistive tech. Omit for a purely decorative spinner. */
	label?: string;
}) {
	return (
		<svg
			className={styles.spinner}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			role={label ? "status" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
		>
			<circle
				cx="12"
				cy="12"
				r="9"
				stroke={color}
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeDasharray="44"
				strokeDashoffset="14"
				opacity="0.9"
			/>
		</svg>
	);
}

/** Centered spinner for a whole pane or page. */
export function LoadingPane({ label = "Loading" }: { label?: string }) {
	return (
		<div className={styles.pane}>
			<Spinner size={26} color="var(--c-accent)" label={label} />
		</div>
	);
}
