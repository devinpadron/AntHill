import React, { forwardRef, useState } from "react";
import {
	StyleProp,
	StyleSheet,
	TextInput,
	TextInputProps,
	View,
	ViewStyle,
} from "react-native";
import { Theme, useTheme, useThemedStyles } from "../../theme";
import { Icon, IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

/**
 * A text field.
 *
 * Replaces `FormInput`, whose hardcoded `width: 350` ignored its container and
 * overflowed on a small phone, and the raw `<TextInput>`s that every other
 * screen styled for itself.
 *
 * Errors render beneath the field rather than in an `Alert`. The app raised
 * roughly 70 alerts, many of them for a single invalid field, which is both
 * heavier than the problem and drops the user's place in the form.
 */

export type InputProps = Omit<TextInputProps, "style"> & {
	label?: string;
	/** Sits under the field. Replaced by `error` when there is one. */
	helper?: string;
	error?: string;
	/** A glyph inside the field's leading edge. */
	icon?: IconName;
	/** A tappable glyph on the trailing edge — clear, search, calendar. */
	trailingIcon?: IconName;
	onTrailingPress?: () => void;
	trailingLabel?: string;
	/** Adds the show/hide toggle. Implies `secureTextEntry`. */
	password?: boolean;
	/** Grows with its content, up to `maxHeight`. */
	multiline?: boolean;
	containerStyle?: StyleProp<ViewStyle>;
	inputStyle?: StyleProp<ViewStyle>;
};

export const Input = forwardRef<TextInput, InputProps>(
	(
		{
			label,
			helper,
			error,
			icon,
			trailingIcon,
			onTrailingPress,
			trailingLabel,
			password = false,
			multiline = false,
			containerStyle,
			inputStyle,
			onFocus,
			onBlur,
			editable = true,
			...rest
		},
		ref,
	) => {
		const theme = useTheme();
		const styles = useThemedStyles(inputStyles);
		const [focused, setFocused] = useState(false);
		const [revealed, setRevealed] = useState(false);

		const hasError = !!error;

		return (
			<View style={containerStyle}>
				{!!label && (
					<Text
						variant="label"
						color="textSecondary"
						style={styles.label}
					>
						{label}
					</Text>
				)}

				<View
					style={[
						styles.field,
						multiline && styles.fieldMultiline,
						focused && styles.fieldFocused,
						hasError && styles.fieldError,
						!editable && styles.fieldDisabled,
						inputStyle,
					]}
				>
					{!!icon && (
						<Icon
							name={icon}
							size="sm"
							color={focused ? "accent" : "textTertiary"}
							style={styles.leadingIcon}
						/>
					)}

					<TextInput
						ref={ref}
						{...rest}
						editable={editable}
						multiline={multiline}
						secureTextEntry={password && !revealed}
						placeholderTextColor={theme.colors.textTertiary}
						/*
						 * Matches the `body` type token. TextInput does not
						 * accept our Text component, so the values are applied
						 * directly rather than duplicated as literals.
						 */
						maxFontSizeMultiplier={
							theme.type.body.maxFontSizeMultiplier
						}
						onFocus={(e) => {
							setFocused(true);
							onFocus?.(e);
						}}
						onBlur={(e) => {
							setFocused(false);
							onBlur?.(e);
						}}
						style={[
							styles.input,
							multiline && styles.inputMultiline,
						]}
					/>

					{password && (
						<IconButton
							name={revealed ? "eye-off-outline" : "eye-outline"}
							onPress={() => setRevealed((v) => !v)}
							label={revealed ? "Hide password" : "Show password"}
							size="sm"
							color="textSecondary"
							haptic={null}
						/>
					)}

					{!!trailingIcon && !password && (
						<IconButton
							name={trailingIcon}
							onPress={onTrailingPress ?? (() => {})}
							label={trailingLabel ?? "Field action"}
							size="sm"
							color="textSecondary"
						/>
					)}
				</View>

				{(hasError || !!helper) && (
					<Text
						variant="caption"
						color={hasError ? "danger" : "textSecondary"}
						style={styles.helper}
					>
						{error ?? helper}
					</Text>
				)}
			</View>
		);
	},
);

Input.displayName = "Input";

const inputStyles = (theme: Theme) =>
	StyleSheet.create({
		label: {
			marginBottom: theme.spacing.xs,
		},
		field: {
			flexDirection: "row",
			alignItems: "center",
			minHeight: theme.hitTarget,
			paddingHorizontal: theme.spacing.md,
			borderRadius: theme.radius.md,
			borderWidth: theme.hairlineWidth,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.surfaceSunken,
		},
		fieldMultiline: {
			alignItems: "flex-start",
			paddingVertical: theme.spacing.md,
			minHeight: 96,
		},
		fieldFocused: {
			borderColor: theme.colors.accent,
			backgroundColor: theme.colors.surface,
		},
		fieldError: {
			borderColor: theme.colors.danger,
		},
		fieldDisabled: {
			opacity: 0.6,
		},
		leadingIcon: {
			marginRight: theme.spacing.sm,
		},
		input: {
			flex: 1,
			fontSize: theme.type.body.fontSize,
			color: theme.colors.text,
			paddingVertical: theme.spacing.sm,
		},
		inputMultiline: {
			textAlignVertical: "top",
			paddingTop: 0,
		},
		helper: {
			marginTop: theme.spacing.xs,
			marginLeft: theme.spacing.xs,
		},
	});
