import { Fragment } from "react";
import { Text, type TextProps } from "./Text";

/*
 * Mirrors src/components/ui/LinkText.tsx: `Text` whose URLs open in a new tab.
 *
 * Notes are plain strings, so links are found at render time rather than
 * stored as markup. Trailing punctuation is kept out of the link so
 * "see https://x.com." does not open "https://x.com.".
 */
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>]+)/gi;
const TRAILING = /[.,;:!?)\]]+$/;

export function LinkText({ children, ...rest }: TextProps) {
	if (typeof children !== "string") return <Text {...rest}>{children}</Text>;

	return (
		<Text {...rest}>
			{children.split(URL_RE).map((part, i) => {
				// Capturing-group split: odd indices are the matches.
				if (i % 2 === 0) return part;
				const trail = part.match(TRAILING)?.[0] ?? "";
				const url = part.slice(0, part.length - trail.length);
				const href = url.startsWith("www.") ? `https://${url}` : url;
				return (
					<Fragment key={i}>
						<a
							href={href}
							target="_blank"
							rel="noopener noreferrer"
						>
							{url}
						</a>
						{trail}
					</Fragment>
				);
			})}
		</Text>
	);
}
