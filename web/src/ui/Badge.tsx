import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Badge.module.css";

/*
 * Mirrors src/components/ui/Badge.tsx. The tone names a MEANING, never a color
 * — src/utils/timeUtils.ts `getStatusTone` maps time-entry statuses onto
 * exactly this vocabulary, and the portal reuses that function, so a status
 * badge here and in the app cannot disagree.
 */

export type BadgeTone =
	"neutral" | "accent" | "success" | "warning" | "danger" | "info";

export type BadgeProps = {
	tone?: BadgeTone;
	/** `subtle` is a tinted fill; `solid` is a filled pill for emphasis. */
	variant?: "subtle" | "solid";
	icon?: IconName;
	/** A 6px leading dot — cheaper than an icon when the tone is the message. */
	dot?: boolean;
	/** Arbitrary color, for user-chosen event-label hexes. */
	color?: string;
	title?: string;
	children?: ReactNode;
};

export function Badge({
	tone = "neutral",
	variant = "subtle",
	icon,
	dot = false,
	color,
	title,
	children,
}: BadgeProps) {
	/*
	 * Event labels carry a user-picked hex (EventLabel.color) — the only
	 * non-token color the app renders. color-mix keeps it legible in both
	 * themes instead of painting raw hex on a near-black surface.
	 */
	const custom = color
		? {
				background: `color-mix(in srgb, ${color} 16%, transparent)`,
				borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
				color: `color-mix(in srgb, ${color} 75%, var(--c-text))`,
			}
		: undefined;

	return (
		<span
			title={title}
			className={[styles.badge, styles[tone], styles[variant]].join(" ")}
			style={custom}
		>
			{dot && (
				<span
					className={styles.dot}
					style={color ? { background: color } : undefined}
				/>
			)}
			{icon && <Icon name={icon} size="xs" />}
			{children}
		</span>
	);
}
