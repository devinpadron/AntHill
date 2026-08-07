import { StyleSheet } from "react-native";
import { Theme } from "../../theme";

export const statisticsStyles = (theme: Theme) =>
	StyleSheet.create({
		hero: {
			alignItems: "center",
			paddingVertical: theme.spacing.md,
		},
		heroCaption: {
			marginTop: theme.spacing.xs,
		},
		yearScroll: {
			marginTop: theme.spacing.lg,
		},
		yearScrollContent: {
			paddingRight: theme.spacing.lg,
		},
		card: {
			marginTop: theme.spacing.lg,
		},
		sectionTitle: {
			marginTop: theme.spacing.xl,
			marginBottom: theme.spacing.sm,
			marginLeft: theme.spacing.xs,
		},
		highlight: {
			flexDirection: "row",
			alignItems: "center",
			paddingHorizontal: theme.spacing.lg,
			paddingVertical: theme.spacing.md,
			minHeight: theme.hitTarget + 8,
		},
		/*
		 * A fixed well, so the labels line up however wide the glyph renders.
		 * Emoji metrics differ per platform and per character — 🏆 and 🌙 are not
		 * the same width on Android.
		 */
		emojiSlot: {
			width: 32,
			alignItems: "center",
			marginRight: theme.spacing.md,
		},
		highlightText: {
			flex: 1,
		},
		highlightCaption: {
			marginTop: 2,
		},
		highlightValue: {
			marginLeft: theme.spacing.md,
		},
		separator: {
			height: theme.hairlineWidth,
			backgroundColor: theme.colors.border,
			marginLeft: theme.spacing.lg + 32 + theme.spacing.md,
		},
		footnote: {
			marginTop: theme.spacing.xl,
			marginBottom: theme.spacing.lg,
		},
	});
