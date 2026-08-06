import { Alert, type AlertButton } from "./react-native";

/*
 * Stands in for `react-native-prompt-android`.
 *
 * src/utils/alertUtils.ts imports it unconditionally but only calls it when
 * Platform.OS === "android" — and the Platform shim reports "web" — so this is
 * dead code at runtime. It exists purely so the import resolves.
 *
 * It still forwards to Alert.prompt rather than throwing: if the Platform
 * branch ever changes, a working dialog is a better failure mode than a blank
 * screen.
 */
export default function prompt(
	title: string,
	message?: string,
	buttons?: AlertButton[],
	options?: { type?: string; defaultValue?: string },
): void {
	Alert.prompt(title, message, buttons, options?.type, options?.defaultValue);
}
