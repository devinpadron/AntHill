import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";
import styles from "./Button.module.css";

/*
 * Mirrors src/components/ui/Button.tsx. Variants name INTENT — a screen asks
 * for "destructive", never for red — which is what lets the dark theme work
 * without touching a call site.
 */

export type ButtonVariant =
	"primary" | "secondary" | "outline" | "ghost" | "destructive";

export type ButtonSize = "small" | "medium" | "large";

export type ButtonProps = {
	variant?: ButtonVariant;
	size?: ButtonSize;
	icon?: IconName;
	iconAfter?: IconName;
	/** Shows a spinner and blocks interaction without changing the width. */
	busy?: boolean;
	fullWidth?: boolean;
	children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function Button({
	variant = "secondary",
	size = "medium",
	icon,
	iconAfter,
	busy = false,
	fullWidth = false,
	disabled,
	className,
	children,
	type = "button",
	...rest
}: ButtonProps) {
	const iconPx = size === "large" ? "md" : "sm";

	return (
		<button
			type={type}
			disabled={disabled || busy}
			aria-busy={busy || undefined}
			className={[
				styles.button,
				styles[variant],
				styles[size],
				fullWidth ? styles.fullWidth : "",
				busy ? styles.busy : "",
				className ?? "",
			]
				.filter(Boolean)
				.join(" ")}
			{...rest}
		>
			{icon && <Icon name={icon} size={iconPx} />}
			{children}
			{iconAfter && <Icon name={iconAfter} size={iconPx} />}
			{busy && (
				<span className={styles.spinner}>
					<Spinner size={size === "small" ? 14 : 18} />
				</span>
			)}
		</button>
	);
}
