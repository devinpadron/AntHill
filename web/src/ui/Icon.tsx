import { ICONS, type IconName } from "./icons.generated";
import { iconSize } from "../theme/tokens.web";

/*
 * Ionicons, inlined as SVG.
 *
 * Mirrors src/components/ui/Icon.tsx in the app, which wraps @expo/vector-icons
 * so screens never touch an icon library directly. Same idea here: one place
 * that knows how an icon is drawn, so the set can be swapped without touching a
 * page.
 *
 * Icons inherit `currentColor`, so color comes from the surrounding text style
 * rather than a prop in the common case.
 */

export type { IconName };

export type IconProps = {
	name: IconName;
	/** Token name, or an explicit pixel size. */
	size?: keyof typeof iconSize | number;
	/** Any CSS color; defaults to inheriting currentColor. */
	color?: string;
	className?: string;
	/**
	 * Icons are decorative by default and hidden from assistive tech. Pass a
	 * label only when the icon is the sole carrier of meaning — a bare icon
	 * button, for instance.
	 */
	label?: string;
};

export function Icon({
	name,
	size = "md",
	color,
	className,
	label,
}: IconProps) {
	const px = typeof size === "number" ? size : iconSize[size];
	const markup = ICONS[name];

	if (!markup) {
		// Loud in dev, invisible in production — a missing glyph should never
		// be the thing that takes a page down.
		if (import.meta.env.DEV) {
			console.error(
				`Icon "${name}" is not vendored. Add it to scripts/build-icons.mjs.`,
			);
		}
		return null;
	}

	return (
		<svg
			viewBox="0 0 512 512"
			width={px}
			height={px}
			fill={color ?? "currentColor"}
			className={className}
			role={label ? "img" : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
			focusable="false"
			style={{ flexShrink: 0, display: "block" }}
			dangerouslySetInnerHTML={{ __html: markup }}
		/>
	);
}
