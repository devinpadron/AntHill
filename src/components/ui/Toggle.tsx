import React, { useCallback } from "react";
import { Switch, SwitchProps } from "react-native";
import { haptics, useTheme } from "../../theme";

/**
 * A switch, themed.
 *
 * RN's `Switch` needs four color props to look right, and CompanyPreferences
 * repeated the same `trackColor`/`thumbColor` literal verbatim for each of its
 * four toggles. Wrapping it once means a feature flag row is `<Toggle …/>` and
 * nothing else, and the haptic comes along with it.
 */

type ToggleProps = Omit<
	SwitchProps,
	"trackColor" | "thumbColor" | "ios_backgroundColor"
> & {
	value: boolean;
	onValueChange: (value: boolean) => void;
};

export const Toggle: React.FC<ToggleProps> = ({
	value,
	onValueChange,
	disabled,
	...rest
}) => {
	const theme = useTheme();

	const handleChange = useCallback(
		(next: boolean) => {
			haptics.selection();
			onValueChange(next);
		},
		[onValueChange],
	);

	return (
		<Switch
			{...rest}
			value={value}
			onValueChange={handleChange}
			disabled={disabled}
			trackColor={{
				false: theme.colors.switchTrack,
				true: theme.colors.accent,
			}}
			/*
			 * Android tints the thumb; iOS keeps it white and tints the track.
			 * A single white thumb reads correctly on both.
			 */
			thumbColor={theme.colors.surface}
			ios_backgroundColor={theme.colors.switchTrack}
			style={[{ opacity: disabled ? 0.5 : 1 }, rest.style]}
		/>
	);
};
