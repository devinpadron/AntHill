import { Theme } from "../../theme";

/**
 * `react-native-calendars` theming.
 *
 * The library takes its own theme object and ignores everything else, so its
 * month grid was the one surface still hardcoded to iOS blue on white — it
 * would have stayed bright white in dark mode. Derived from our tokens here so
 * there is a single place it can drift from.
 */
export const calendarTheme = (theme: Theme) => ({
	calendarBackground: theme.colors.surfaceRaised,
	backgroundColor: theme.colors.surfaceRaised,

	/* Month name and the S/M/T/W column headings. */
	monthTextColor: theme.colors.text,
	textSectionTitleColor: theme.colors.textTertiary,
	arrowColor: theme.colors.accent,
	indicatorColor: theme.colors.accent,

	dayTextColor: theme.colors.text,
	textDisabledColor: theme.colors.textTertiary,
	todayTextColor: theme.colors.accent,

	selectedDayBackgroundColor: theme.colors.accent,
	selectedDayTextColor: theme.colors.onAccent,

	/* Event dots. A day's own label color overrides this per marked date. */
	dotColor: theme.colors.accent,
	selectedDotColor: theme.colors.onAccent,

	textDayFontSize: theme.type.body.fontSize,
	textMonthFontSize: theme.type.heading.fontSize,
	textDayHeaderFontSize: theme.type.caption.fontSize,
	textDayFontWeight: "400" as const,
	textMonthFontWeight: "600" as const,
	textDayHeaderFontWeight: "600" as const,
});
