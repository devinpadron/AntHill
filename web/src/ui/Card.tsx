import type { CSSProperties, ReactNode } from "react";
import { Text } from "./Text";
import styles from "./Card.module.css";

/*
 * Mirrors src/components/ui/Card.tsx — surface fill, radius.lg, and a HAIRLINE
 * border rather than a shadow. The app's design leans on lines, not elevation;
 * `elevation="raised"` swaps the border for a shadow and is reserved for things
 * that genuinely float.
 *
 * Header/Body/Footer are new: a phone card is one block, a desktop card usually
 * has a title row with actions in it.
 */

export type CardProps = {
	/** Rendered as an uppercase overline, matching the app's card titles. */
	title?: string;
	/** Right-aligned controls in the header row. */
	actions?: ReactNode;
	elevation?: "hairline" | "raised";
	/** Turn off inner padding when the card holds a full-bleed table. */
	flush?: boolean;
	className?: string;
	style?: CSSProperties;
	children?: ReactNode;
};

export function Card({
	title,
	actions,
	elevation = "hairline",
	flush = false,
	className,
	style,
	children,
}: CardProps) {
	return (
		<section
			className={[
				styles.card,
				elevation === "raised" ? styles.raised : "",
				className ?? "",
			]
				.filter(Boolean)
				.join(" ")}
			style={style}
		>
			{(title || actions) && (
				<header className={styles.header}>
					{title && (
						<Text variant="overline" tone="secondary">
							{title}
						</Text>
					)}
					{actions && <div className={styles.actions}>{actions}</div>}
				</header>
			)}
			<div className={flush ? styles.bodyFlush : styles.body}>
				{children}
			</div>
		</section>
	);
}
