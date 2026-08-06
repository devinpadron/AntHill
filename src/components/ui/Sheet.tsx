import React, { forwardRef, useCallback } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import BottomSheet, {
	BottomSheetBackdrop,
	BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme, useThemedStyles } from "../../theme";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

/**
 * A bottom sheet.
 *
 * `@gorhom/bottom-sheet` v4 defaults to a white background and a gray handle
 * regardless of theme, and the six sheets in the app each passed their own
 * `backgroundStyle`. This applies the tokens once and adds the dimming backdrop
 * that most of them were missing — without one, a sheet reads as part of the
 * page behind it rather than above it.
 *
 * Pairs with the existing `useBottomSheetController` hook: give it that hook's
 * `bottomSheetRef` and `handleSheetChanges`.
 */

type SheetProps = {
	children: React.ReactNode;
	snapPoints: (string | number)[];
	/** Titles the sheet and gives it a close button. */
	title?: string;
	onClose?: () => void;
	onChange?: (index: number) => void;
	/** -1 keeps it closed until something calls `snapToIndex`. */
	index?: number;
	enablePanDownToClose?: boolean;
	/** Dims and blocks the content behind. Off for a persistent panel. */
	backdrop?: boolean;
	style?: StyleProp<ViewStyle>;
};

export const Sheet = forwardRef<BottomSheet, SheetProps>(
	(
		{
			children,
			snapPoints,
			title,
			onClose,
			onChange,
			index = -1,
			enablePanDownToClose = true,
			backdrop = true,
			style,
		},
		ref,
	) => {
		const styles = useThemedStyles(sheetStyles);
		const insets = useSafeAreaInsets();

		const renderBackdrop = useCallback(
			(props: BottomSheetBackdropProps) => (
				<BottomSheetBackdrop
					{...props}
					appearsOnIndex={0}
					disappearsOnIndex={-1}
					opacity={1}
					pressBehavior="close"
					style={[props.style, styles.backdrop]}
				/>
			),
			[styles.backdrop],
		);

		return (
			<BottomSheet
				ref={ref}
				index={index}
				snapPoints={snapPoints}
				onChange={onChange}
				onClose={onClose}
				enablePanDownToClose={enablePanDownToClose}
				/*
				 * The sheet tracks the keyboard rather than being covered by it —
				 * several sheets hold search fields and form editors. `restore`
				 * returns it to its snap point when the field blurs.
				 */
				keyboardBehavior="interactive"
				keyboardBlurBehavior="restore"
				android_keyboardInputMode="adjustResize"
				backdropComponent={backdrop ? renderBackdrop : undefined}
				backgroundStyle={styles.background}
				handleIndicatorStyle={styles.handle}
				style={style}
			>
				{!!title && (
					<View style={styles.header}>
						{/* Spacer, so the title stays centered against the close button. */}
						<View style={styles.headerSlot} />
						<Text variant="heading" numberOfLines={1}>
							{title}
						</Text>
						<View style={[styles.headerSlot, styles.headerEnd]}>
							{!!onClose && (
								<IconButton
									name="close"
									onPress={onClose}
									label="Close"
									size="sm"
									color="textSecondary"
								/>
							)}
						</View>
					</View>
				)}

				<View
					style={[
						styles.body,
						/* Keeps content clear of the home indicator. */
						{ paddingBottom: insets.bottom },
					]}
				>
					{children}
				</View>
			</BottomSheet>
		);
	},
);

Sheet.displayName = "Sheet";

const sheetStyles = (theme: Theme) =>
	StyleSheet.create({
		background: {
			backgroundColor: theme.colors.surfaceRaised,
			borderTopLeftRadius: theme.radius.xl,
			borderTopRightRadius: theme.radius.xl,
		},
		handle: {
			backgroundColor: theme.colors.borderStrong,
			width: 36,
		},
		backdrop: {
			backgroundColor: theme.colors.overlay,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: theme.spacing.sm,
			paddingBottom: theme.spacing.md,
			borderBottomWidth: theme.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		headerSlot: {
			width: 40,
			flexDirection: "row",
			alignItems: "center",
		},
		headerEnd: {
			justifyContent: "flex-end",
		},
		body: {
			flex: 1,
		},
	});
