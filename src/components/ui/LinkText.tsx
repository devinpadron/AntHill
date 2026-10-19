import React from "react";
import { Linking } from "react-native";
import { Text } from "./Text";

/**
 * `Text` whose URLs open in the browser.
 *
 * Notes are plain strings, so links are found at render time rather than
 * stored as markup. `dataDetectorType` would do this natively but is
 * Android-only, hence the split. Trailing punctuation is kept out of the link
 * so "see https://x.com." does not open "https://x.com.".
 */
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>]+)/gi;
const TRAILING = /[.,;:!?)\]]+$/;

export const LinkText: React.FC<React.ComponentProps<typeof Text>> = ({
	children,
	...rest
}) => {
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
					<React.Fragment key={i}>
						<Text
							{...rest}
							color="accent"
							style={{ textDecorationLine: "underline" }}
							onPress={() =>
								Linking.openURL(href).catch(() => {})
							}
						>
							{url}
						</Text>
						{trail}
					</React.Fragment>
				);
			})}
		</Text>
	);
};
