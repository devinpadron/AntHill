import React from "react";
import { Input } from "./Input";

/**
 * Deprecated. Use `Input`.
 *
 * Kept as a shim so the three auth screens keep compiling until Phase 3
 * rewrites them; it will be deleted with its last caller. The old version
 * hardcoded `width: 350`, which overflowed the container on a small phone.
 */

type FormInputProps = {
	placeholder: string;
	value: string;
	onChangeText: (text: string) => void;
	secureTextEntry?: boolean;
	keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
	/** Defaults to "none" — every existing caller is an email or a password. */
	autoCapitalize?: "none" | "characters" | "words" | "sentences";
};

export const FormInput = ({
	placeholder,
	value,
	onChangeText,
	secureTextEntry = false,
	keyboardType = "default",
	autoCapitalize = "none",
}: FormInputProps) => (
	<Input
		placeholder={placeholder}
		value={value}
		onChangeText={onChangeText}
		password={secureTextEntry}
		keyboardType={keyboardType}
		autoCapitalize={autoCapitalize}
		autoCorrect={false}
		containerStyle={{ width: "100%" }}
	/>
);
