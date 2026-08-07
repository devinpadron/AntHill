import React, { useEffect, useRef, useState } from "react";
import {
	Keyboard,
	KeyboardAvoidingView,
	KeyboardEvent,
	LayoutChangeEvent,
	Platform,
	RefreshControlProps,
	ScrollView,
	StatusBar,
	StyleProp,
	StyleSheet,
	View,
	ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { OfflineBanner } from "./OfflineBanner";
import { Theme, useTheme, useThemedStyles } from "../../theme";

/**
 * The screen shell. Every screen starts here.
 *
 * It exists to settle three things that were decided independently on each of
 * ~25 screens: how the safe area is handled (there were three competing
 * strategies, and one screen applied two at once and double-counted the inset),
 * what the background is (there were four different off-whites), and what
 * happens when the keyboard opens (most screens did nothing).
 *
 * `header` is rendered OUTSIDE the scroll container on purpose — several
 * screens put their header inside the ScrollView, so it scrolled away.
 */

export type ScreenKeyboardMode =
	/** Content lifts as a block. For short, non-scrolling forms. */
	| "avoid"
	/** Scrolls the focused input into view. For long forms. */
	| "aware"
	| "none";

/**
 * How much of a given view the keyboard actually covers.
 *
 * NOT the keyboard's height. The keyboard is measured from the bottom of the
 * WINDOW, but a screen inside the tab navigator ends above the tab bar — so
 * offsetting a footer by the raw keyboard height left it floating a tab bar's
 * worth of empty space above the keys. Measuring the container and taking the
 * real overlap is correct on every screen, tabbed or not.
 */
const useKeyboardOverlap = (ref: React.RefObject<View>) => {
	/*
	 * `excess` is how much taller the keyboard is than the part of it that
	 * actually covers this view — i.e. the tab bar. KeyboardAwareScrollView
	 * pads by the raw height too, so it needs the same correction.
	 */
	const [{ overlap, excess }, setState] = useState({ overlap: 0, excess: 0 });

	useEffect(() => {
		/*
		 * iOS reports `will*` ahead of the animation, which keeps the footer in
		 * step with the keyboard. Android only fires `did*` reliably.
		 */
		const showEvent =
			Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvent =
			Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

		const show = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
			const keyboardTop = e.endCoordinates.screenY;

			ref.current?.measureInWindow((_x, y, _width, height) => {
				const covered = Math.max(0, y + height - keyboardTop);
				setState({
					overlap: covered,
					excess: Math.max(0, e.endCoordinates.height - covered),
				});
			});
		});
		const hide = Keyboard.addListener(hideEvent, () =>
			setState({ overlap: 0, excess: 0 }),
		);

		return () => {
			show.remove();
			hide.remove();
		};
	}, [ref]);

	return { overlap, excess };
};

/** Whether the keyboard is up at all. */
const useKeyboardVisible = () => {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const showEvent =
			Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
		const hideEvent =
			Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

		const show = Keyboard.addListener(showEvent, () => setVisible(true));
		const hide = Keyboard.addListener(hideEvent, () => setVisible(false));

		return () => {
			show.remove();
			hide.remove();
		};
	}, []);

	return visible;
};

type ScreenProps = {
	children: React.ReactNode;
	/** Pinned above the content. Usually a `ScreenHeader`. */
	header?: React.ReactNode;
	/** Pinned below the content, above the keyboard. Usually a save bar. */
	footer?: React.ReactNode;
	scroll?: boolean;
	keyboard?: ScreenKeyboardMode;
	/**
	 * Which safe-area edges to pad. Defaults to the top only — screens inside
	 * the tab navigator get their bottom inset from the tab bar, and adding it
	 * here again is exactly the double-count bug this replaces.
	 */
	edges?: ("top" | "bottom")[];
	/** Horizontal gutters on the content. Off for full-bleed lists. */
	padded?: boolean;
	/** Fills behind the content; defaults to the themed page background. */
	background?: string;
	/**
	 * What colour the safe-area strip behind the notch takes.
	 *
	 * Defaults to the header's colour when `header` is set. Pass "surface"
	 * explicitly on a screen that renders its own `ScreenHeader` as a child
	 * instead — otherwise a band appears between the notch and the header.
	 */
	topBand?: "surface" | "page";
	style?: StyleProp<ViewStyle>;
	contentContainerStyle?: StyleProp<ViewStyle>;
	refreshControl?: React.ReactElement<RefreshControlProps>;
	testID?: string;
};

export const Screen: React.FC<ScreenProps> = ({
	children,
	header,
	footer,
	scroll = false,
	keyboard = "none",
	edges = ["top"],
	padded = false,
	background,
	topBand,
	style,
	contentContainerStyle,
	refreshControl,
	testID,
}) => {
	const theme = useTheme();
	const styles = useThemedStyles(screenStyles);
	const insets = useSafeAreaInsets();
	const rootRef = useRef<View>(null);
	const { overlap: keyboardOverlap, excess: keyboardExcess } =
		useKeyboardOverlap(rootRef);
	const [footerHeight, setFooterHeight] = useState(0);

	const onFooterLayout = (event: LayoutChangeEvent) =>
		setFooterHeight(event.nativeEvent.layout.height);

	const contentStyle = [
		padded && styles.padded,
		scroll && styles.scrollContent,
		/* Keeps the last field clear of the sticky footer. */
		!!footer && { paddingBottom: footerHeight + theme.spacing.lg },
		contentContainerStyle,
	];

	/*
	 * The strip behind the notch takes the HEADER's colour, not the page's.
	 *
	 * Painting it with `bg` while the header sat on `surface` drew a visible
	 * band across the top of every screen, which read as the whole app being
	 * pushed down by the Dynamic Island rather than running underneath it.
	 */
	const bandMode = topBand ?? (header ? "surface" : "page");
	const topBandColor =
		bandMode === "surface"
			? theme.colors.surface
			: (background ?? theme.colors.bg);

	const content = scroll ? (
		keyboard === "aware" ? (
			<KeyboardAwareScrollView
				style={styles.flex}
				contentContainerStyle={contentStyle}
				keyboardShouldPersistTaps="handled"
				enableOnAndroid
				/*
				 * Room between the focused field and whatever is below it —
				 * the keyboard, plus the floating footer if there is one.
				 * `keyboardExcess` cancels the part of the keyboard the tab
				 * bar already accounts for, which the library would otherwise
				 * pad for twice.
				 */
				extraScrollHeight={
					theme.spacing.xl + footerHeight - keyboardExcess
				}
				/* Otherwise blurring a field snaps the list back to the top. */
				enableResetScrollToCoords={false}
				showsVerticalScrollIndicator={false}
				refreshControl={refreshControl}
			>
				{children}
			</KeyboardAwareScrollView>
		) : (
			<ScrollView
				style={styles.flex}
				contentContainerStyle={contentStyle}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
				refreshControl={refreshControl}
			>
				{children}
			</ScrollView>
		)
	) : (
		<View style={[styles.flex, contentStyle]}>{children}</View>
	);

	/*
	 * The footer FLOATS over the content rather than sitting below it.
	 *
	 * It used to be in flow with `marginBottom: keyboardHeight`, which shrank
	 * the scroll view by the keyboard's height — and then the scroll view
	 * scrolled by that height as well, displacing the focused field by twice
	 * the keyboard and pushing it back off screen. Taking the footer out of
	 * flow leaves exactly one thing moving; the content clears it via
	 * `paddingBottom` instead.
	 */
	const footerNode = !!footer && (
		<View
			onLayout={onFooterLayout}
			style={
				keyboard === "avoid"
					? undefined
					: [styles.floatingFooter, { bottom: keyboardOverlap }]
			}
		>
			{footer}
		</View>
	);

	/*
	 * "avoid" physically shrinks the screen, which is what centred forms need —
	 * they cannot scroll, so the content has to re-centre into the space left.
	 * "aware" scrolls instead, for forms longer than the screen.
	 */
	const body =
		keyboard === "avoid" ? (
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
			>
				{content}
				{footerNode}
			</KeyboardAvoidingView>
		) : (
			<>
				{content}
				{footerNode}
			</>
		);

	return (
		<View
			ref={rootRef}
			testID={testID}
			style={[
				styles.root,
				background ? { backgroundColor: background } : null,
				edges.includes("bottom") && { paddingBottom: insets.bottom },
				style,
			]}
		>
			<StatusBar
				barStyle={theme.isDark ? "light-content" : "dark-content"}
				backgroundColor={topBandColor}
			/>

			{/* Painted rather than padded, so it can carry the header's colour. */}
			{edges.includes("top") && (
				<View
					style={{
						height: insets.top,
						backgroundColor: topBandColor,
					}}
				/>
			)}

			{header}
			{/*
			 * Below the header so it does not displace the title, above the
			 * content so it never covers anything. Renders nothing when online,
			 * and only one Screen is mounted at a time — so this is the app's
			 * single offline indicator rather than one per screen.
			 */}
			<OfflineBanner />
			{body}
		</View>
	);
};

/**
 * A sticky bottom bar for a screen's primary action.
 *
 * Pass it as `Screen`'s `footer` so it lifts with the keyboard rather than
 * sitting under it.
 */
export const ScreenFooter: React.FC<{
	children: React.ReactNode;
	/** Adds the bottom safe-area inset. Off for screens inside the tab bar. */
	safeArea?: boolean;
	style?: StyleProp<ViewStyle>;
}> = ({ children, safeArea = false, style }) => {
	const theme = useTheme();
	const styles = useThemedStyles(screenStyles);
	const insets = useSafeAreaInsets();
	const keyboardVisible = useKeyboardVisible();

	/*
	 * The keyboard already covers the home indicator, so keeping the bottom
	 * inset while it is open leaves a visible gap under the bar.
	 */
	const bottomInset = keyboardVisible ? 0 : insets.bottom;

	return (
		<View
			style={[
				styles.footer,
				safeArea && {
					paddingBottom: bottomInset + theme.spacing.md,
				},
				style,
			]}
		>
			{children}
		</View>
	);
};

const screenStyles = (theme: Theme) =>
	StyleSheet.create({
		root: {
			flex: 1,
			backgroundColor: theme.colors.bg,
		},
		flex: {
			flex: 1,
		},
		padded: {
			paddingHorizontal: theme.spacing.lg,
		},
		scrollContent: {
			flexGrow: 1,
			paddingBottom: theme.spacing.xl,
		},
		footer: {
			paddingHorizontal: theme.spacing.lg,
			paddingTop: theme.spacing.md,
			paddingBottom: theme.spacing.md,
			backgroundColor: theme.colors.surface,
			borderTopWidth: theme.hairlineWidth,
			borderTopColor: theme.colors.border,
		},
		floatingFooter: {
			position: "absolute",
			left: 0,
			right: 0,
		},
	});
