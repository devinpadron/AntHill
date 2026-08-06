import { NativeStackNavigationOptions } from "@react-navigation/native-stack";

/**
 * Shared options for every stack in the app.
 *
 * Each of the six stacks repeated `headerShown: false` on every screen and then
 * disagreed about `gestureEnabled` — some routes could be swiped back, some
 * could not, for no reason a user could infer. Setting them once on the
 * navigator makes the behaviour uniform and leaves per-screen `options` for
 * things that are genuinely per-screen.
 *
 * Headers stay off because the app draws its own (`ScreenHeader`), which is
 * what lets a header carry a subtitle, a search field or a week picker.
 */
export const stackScreenOptions: NativeStackNavigationOptions = {
	headerShown: false,
	gestureEnabled: true,
	animation: "slide_from_right",
	/*
	 * Without this the transition reveals React Navigation's own card color for
	 * a frame. The NavigationContainer theme sets it globally; naming it here
	 * too keeps stacks correct if that theme is ever bypassed.
	 */
	animationTypeForReplace: "push",
};
