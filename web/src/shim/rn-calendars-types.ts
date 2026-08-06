/*
 * Stands in for `react-native-calendars/src/types`.
 *
 * ../../src/hooks/useCalendarEvents.ts imports exactly one TYPE from it —
 * `MarkedDates`, the shape it builds for the phone's calendar grid. Nothing at
 * runtime comes from this module, but the specifier still has to resolve for
 * both tsc and the bundler.
 *
 * Shimming it is what lets the portal reuse that hook verbatim, which matters:
 * the hook owns the date-window arithmetic and the `refineSelection` wiring
 * that decide WHICH events a filter actually returns. Re-deriving that for the
 * web would be the single easiest place for the two clients to disagree about
 * what "my events" means.
 *
 * The portal ignores `markedDates` and renders its own month grid — but taking
 * the field costs nothing, and it stays correct if the app's shape changes.
 */

export type DotMarking = {
	key?: string;
	color: string;
	selectedDotColor?: string;
};

export type MarkingProps = {
	selected?: boolean;
	marked?: boolean;
	dotColor?: string;
	dots?: DotMarking[];
	selectedColor?: string;
	selectedTextColor?: string;
	disabled?: boolean;
	disableTouchEvent?: boolean;
	today?: boolean;
	[key: string]: unknown;
};

export type MarkedDates = Record<string, MarkingProps>;
