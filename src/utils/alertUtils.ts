import { Alert, Platform } from "react-native";
import prompt from "react-native-prompt-android";

type PromptButtons = Array<{
	text: string;
	onPress?: (value?: string) => void;
	style?: "default" | "cancel" | "destructive";
}>;

type PromptOptions = {
	defaultValue?: string;
	isSecure?: boolean;
};

export const showPrompt = (
	title: string,
	message: string,
	buttons: PromptButtons,
	options: PromptOptions = {},
) => {
	const { defaultValue = "", isSecure = false } = options;

	if (Platform.OS === "android") {
		prompt(title, message, buttons, {
			type: isSecure ? "secure-text" : "plain-text",
			defaultValue,
		});
	} else {
		Alert.prompt(
			title,
			message,
			buttons,
			isSecure ? "secure-text" : "plain-text",
			defaultValue,
		);
	}
};

export const showConfirmation = (
	title: string,
	message: string,
	onConfirm: () => void,
	confirmText = "OK",
	confirmStyle: "default" | "cancel" | "destructive" = "default",
) => {
	Alert.alert(title, message, [
		{ text: "Cancel", style: "cancel" },
		{ text: confirmText, style: confirmStyle, onPress: onConfirm },
	]);
};
