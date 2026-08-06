import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import styles from "./EmptyState.module.css";

/*
 * Mirrors src/components/ui/EmptyState.tsx — a circular sunken icon well, a
 * heading, a constrained description, and at most one action.
 *
 * `tone="error"` covers the case the app handles with an alert: a query that
 * failed rather than a list that is genuinely empty. Those must not look the
 * same, or a missing Firestore index reads as "no events".
 */
export function EmptyState({
	icon = "albums-outline",
	title,
	description,
	action,
	tone = "empty",
}: {
	icon?: IconName;
	title: string;
	description?: string;
	action?: ReactNode;
	tone?: "empty" | "error";
}) {
	return (
		<div className={styles.wrap}>
			<div
				className={[
					styles.well,
					tone === "error" ? styles.wellError : "",
				]
					.filter(Boolean)
					.join(" ")}
			>
				<Icon
					name={tone === "error" ? "alert-circle-outline" : icon}
					size="xl"
				/>
			</div>
			<Text variant="heading" align="center">
				{title}
			</Text>
			{description && (
				<Text
					variant="body"
					tone="secondary"
					align="center"
					className={styles.description}
				>
					{description}
				</Text>
			)}
			{action && <div className={styles.action}>{action}</div>}
		</div>
	);
}
