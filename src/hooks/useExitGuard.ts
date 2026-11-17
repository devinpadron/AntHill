import { useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";

type ExitGuardOptions = {
	/** True while the screen holds edits that leaving would lose. */
	isDirty: boolean;
	/**
	 * Saves the edits. Resolve `true` to have the guard finish the exit the
	 * user asked for, `false` to stay put — the save failed, was blocked by
	 * validation, or navigates away by itself. Omit it and the prompt offers
	 * only "Discard" and "Keep editing".
	 */
	onSave?: () => Promise<boolean> | boolean;
	title?: string;
	message?: string;
};

/**
 * Asks before a screen with unsaved edits is left — by ANY route.
 *
 * The screens that guarded at all did it inside their own back-arrow handler,
 * which covers exactly one of the three ways out. The Android hardware back
 * button and the iOS edge swipe never reached that handler, so they dropped
 * the edits without a word, and the screens with no handler dropped them from
 * the arrow as well. `beforeRemove` is the one place all of them pass through.
 *
 * The edge swipe is switched off while dirty rather than intercepted:
 * native-stack hands the gesture to UIKit, which has already popped the screen
 * by the time JS could object, leaving the prompt on top of the wrong screen.
 *
 * Returns `allowExit`, for the screen's own post-save / post-delete
 * navigation, which must not be asked about the changes it just handled.
 */
export const useExitGuard = (
	navigation: any,
	{ isDirty, onSave, title, message }: ExitGuardOptions,
) => {
	const bypass = useRef(false);
	const prompting = useRef(false);
	// The listener is registered once; it reads the current values from here.
	const latest = useRef({ isDirty, onSave, title, message });
	latest.current = { isDirty, onSave, title, message };

	useEffect(() => {
		navigation.setOptions({ gestureEnabled: !isDirty });
	}, [navigation, isDirty]);

	useEffect(
		() =>
			navigation.addListener("beforeRemove", (e: any) => {
				const current = latest.current;
				if (bypass.current || !current.isDirty) return;

				e.preventDefault();
				// A second back press while the prompt is up must not stack another.
				if (prompting.current) return;
				prompting.current = true;

				const leave = () => {
					bypass.current = true;
					navigation.dispatch(e.data.action);
				};
				const done = () => {
					prompting.current = false;
				};

				const buttons: any[] = [
					{ text: "Keep editing", style: "cancel", onPress: done },
					{
						text: "Discard",
						style: "destructive",
						onPress: () => {
							done();
							leave();
						},
					},
				];

				if (current.onSave) {
					buttons.push({
						text: "Save",
						onPress: () => {
							done();
							void (async () => {
								// Read again: the prompt may have sat open a while.
								const saved = await latest.current.onSave?.();
								if (saved) leave();
							})();
						},
					});
				}

				Alert.alert(
					current.title ??
						(current.onSave ? "Save changes?" : "Discard changes?"),
					current.message ?? "You have unsaved changes.",
					buttons,
					// Android: tapping outside dismisses with no button callback.
					{ cancelable: true, onDismiss: done },
				);
			}),
		[navigation],
	);

	const allowExit = useCallback(() => {
		bypass.current = true;
	}, []);

	return { allowExit };
};
