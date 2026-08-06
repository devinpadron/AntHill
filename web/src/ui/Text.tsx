import type { CSSProperties, ElementType, ReactNode } from "react";
import type { TypeVariant } from "../theme/tokens.web";

/*
 * Typography. Mirrors src/components/ui/Text.tsx: screens name a ROLE
 * ("heading", "caption") rather than a font size, so the scale can move in one
 * place.
 *
 * Every variant resolves to the --t-* custom properties emitted from
 * theme/tokens.web.ts, which carry the same numbers as the app's type scale.
 */

export type TextTone =
	| "default"
	| "secondary"
	| "tertiary"
	| "accent"
	| "success"
	| "warning"
	| "danger"
	| "inverse";

const TONE_VAR: Record<TextTone, string> = {
	default: "--c-text",
	secondary: "--c-text-secondary",
	tertiary: "--c-text-tertiary",
	accent: "--c-accent",
	success: "--c-success",
	warning: "--c-warning",
	danger: "--c-danger",
	inverse: "--c-text-inverse",
};

/** Sensible default element per variant, overridable with `as`. */
const DEFAULT_TAG: Record<TypeVariant, ElementType> = {
	display: "h1",
	title: "h2",
	heading: "h3",
	body: "p",
	bodyStrong: "p",
	label: "span",
	caption: "span",
	overline: "h4",
};

export type TextProps = {
	variant?: TypeVariant;
	tone?: TextTone;
	as?: ElementType;
	/** Clamp to N lines with an ellipsis. 1 uses single-line truncation. */
	clamp?: number;
	align?: CSSProperties["textAlign"];
	mono?: boolean;
	className?: string;
	style?: CSSProperties;
	title?: string;
	id?: string;
	/** For error text that must be announced, and other live regions. */
	role?: string;
	"aria-live"?: "off" | "polite" | "assertive";
	children?: ReactNode;
};

export function Text({
	variant = "body",
	tone = "default",
	as,
	clamp,
	align,
	mono,
	className,
	style,
	title,
	id,
	children,
	...aria
}: TextProps) {
	const Tag = as ?? DEFAULT_TAG[variant];
	const cssVariant = variant.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

	const clampStyle: CSSProperties =
		clamp === 1
			? {
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}
			: clamp
				? {
						display: "-webkit-box",
						WebkitLineClamp: clamp,
						WebkitBoxOrient: "vertical",
						overflow: "hidden",
					}
				: {};

	return (
		<Tag
			id={id}
			title={title}
			className={className}
			{...aria}
			style={{
				font: `var(--t-${cssVariant})`,
				letterSpacing: `var(--tt-${cssVariant})`,
				color: `var(${TONE_VAR[tone]})`,
				textTransform: variant === "overline" ? "uppercase" : undefined,
				fontFamily: mono ? "var(--font-mono)" : undefined,
				textAlign: align,
				...clampStyle,
				...style,
			}}
		>
			{children}
		</Tag>
	);
}
