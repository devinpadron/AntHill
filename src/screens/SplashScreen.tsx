import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { Logo } from "../components/ui/Logo";
import { Theme, useThemedStyles } from "../theme";

/**
 * The launch screen.
 *
 * The ONLY splash the app draws. The native launch screen is a bare colour
 * matching this one's background (see the expo-splash-screen plugin in
 * app.config.js), so the handoff between them is invisible and the mark appears
 * exactly once.
 *
 * Deliberately quiet: the mark, and nothing else. It previously spelled out
 * "AntHill" in 32pt beneath a logo that already says AntHill, plus a
 * "Loading..." line — three pieces of chrome for a screen that exists for a
 * second or two.
 *
 * It neither hides itself nor lifts the native launch screen (`AppGate`
 * renders before this does, so the reveal belongs above it — see
 * useHideNativeSplash). `AppNavigator` renders this while `initializing` is
 * true and swaps it out when auth resolves; a self-timer would blank the screen
 * on any launch slower than the timer.
 */
const SplashScreen = () => {
	const styles = useThemedStyles(splashStyles);
	const opacity = useSharedValue(0);
	const scale = useSharedValue(0.96);

	useEffect(() => {
		opacity.value = withTiming(1, { duration: 320 });
		scale.value = withTiming(1, { duration: 420 });
	}, [opacity, scale]);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
		transform: [{ scale: scale.value }],
	}));

	return (
		<Animated.View style={styles.container}>
			<Animated.View style={animatedStyle}>
				<Logo width={200} height={110} />
			</Animated.View>
		</Animated.View>
	);
};

const splashStyles = (theme: Theme) =>
	StyleSheet.create({
		container: {
			flex: 1,
			justifyContent: "center",
			alignItems: "center",
			backgroundColor: theme.colors.bg,
		},
	});

export default SplashScreen;
