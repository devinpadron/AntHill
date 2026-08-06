import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme";
import { ColorTokens } from "../../theme/themes";

/**
 * The painted strip behind the notch or Dynamic Island.
 *
 * `Screen` does this itself. This is for screens that still draw their own
 * header rather than passing one to `Screen` — they used
 * `paddingTop: insets.top` on a container coloured with the page background,
 * which left a visible band between the island and a header sitting on
 * `surface`. Rendering the strip in the header's colour makes the header run
 * continuously up under the island instead.
 *
 * Drop the container's `paddingTop` when you add this — the band replaces it.
 */
export const SafeAreaBand: React.FC<{
	/** Should match whatever sits directly below it. */
	color?: keyof ColorTokens;
}> = ({ color = "surface" }) => {
	const theme = useTheme();
	const insets = useSafeAreaInsets();

	return (
		<View
			style={{
				height: insets.top,
				backgroundColor: theme.colors[color],
			}}
		/>
	);
};
