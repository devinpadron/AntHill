import React, { useCallback, useMemo, useState } from "react";
import {
	LayoutAnimation,
	Platform,
	ScrollView,
	StyleSheet,
	UIManager,
	View,
} from "react-native";
import { Theme, useThemedStyles } from "../../theme";
import { Checkbox, Icon, Input, Pressable, Text } from "../ui";

// Enable LayoutAnimation on Android
if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Pick people from the company roster.
 *
 * The lists this replaces rendered a fixed number of rows and then said "12
 * more — search to narrow the list", which quietly made a manager's memory the
 * only way to reach anyone past the cap: you had to already know the name, and
 * spell it. Browsing is the common case (who is free on Saturday?), so the
 * whole roster is one list behind a disclosure now, and the search box only
 * narrows what is already reachable.
 *
 * Collapsed, the control still says who is picked, so a long roster does not
 * cost the summary. Past `SCROLL_THRESHOLD` rows the list gets its own bounded
 * scroll area rather than pushing the rest of the form off the screen.
 */

export type PersonOption = {
	id: string;
	label: string;
};

type PersonPickerProps = {
	options: PersonOption[];
	selectedIds: string[];
	onToggle: (id: string) => void;
	/** Trailing content for a row — a response badge, say. */
	renderAccessory?: (option: PersonOption) => React.ReactNode;
	/** Collapsed-row copy while nothing is selected. */
	placeholder?: string;
	searchPlaceholder?: string;
	/** Shown in place of the list when the roster itself is empty. */
	emptyText?: string;
	testID?: string;
};

/** Above this many people the list offers a search box. */
const SEARCH_THRESHOLD = 8;

/** Above this many rows the list scrolls inside itself instead of growing. */
const SCROLL_THRESHOLD = 8;

const MAX_LIST_HEIGHT = 320;

/** How many names the collapsed summary spells out before counting. */
const SUMMARY_NAME_CAP = 3;

export const PersonPicker: React.FC<PersonPickerProps> = ({
	options,
	selectedIds,
	onToggle,
	renderAccessory,
	placeholder = "Tap to choose people",
	searchPlaceholder = "Search people",
	emptyText = "Nobody here yet.",
	testID,
}) => {
	const styles = useThemedStyles(personPickerStyles);
	const [expanded, setExpanded] = useState(false);
	const [search, setSearch] = useState("");

	const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

	/* Summary reads in roster order, not the order they were tapped. */
	const summary = useMemo(() => {
		const names = options
			.filter((o) => selected.has(o.id))
			.map((o) => o.label);
		if (names.length === 0) return placeholder;
		if (names.length <= SUMMARY_NAME_CAP) return names.join(", ");
		return `${names.slice(0, SUMMARY_NAME_CAP).join(", ")} +${
			names.length - SUMMARY_NAME_CAP
		} more`;
	}, [options, selected, placeholder]);

	const visible = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return options;
		return options.filter((o) => o.label.toLowerCase().includes(term));
	}, [options, search]);

	const toggleExpanded = useCallback(() => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setExpanded((prev) => {
			/* A stale filter would hide people the next time it opens. */
			if (prev) setSearch("");
			return !prev;
		});
	}, []);

	const rows = visible.map((option) => {
		const accessory = renderAccessory?.(option);

		return (
			<View key={option.id} style={styles.row}>
				<Checkbox
					checked={selected.has(option.id)}
					onPress={() => onToggle(option.id)}
					label={option.label}
					style={styles.rowCheckbox}
				/>
				{accessory}
			</View>
		);
	});

	const list =
		visible.length === 0 ? (
			<Text variant="caption" color="textTertiary">
				{options.length === 0 ? emptyText : "Nobody matches that name."}
			</Text>
		) : visible.length > SCROLL_THRESHOLD ? (
			<ScrollView
				style={styles.scroll}
				nestedScrollEnabled
				keyboardShouldPersistTaps="handled"
			>
				{rows}
			</ScrollView>
		) : (
			<View>{rows}</View>
		);

	return (
		<View testID={testID}>
			<Pressable
				onPress={toggleExpanded}
				scaleOnPress={false}
				haptic="selection"
				style={styles.control}
				accessibilityRole="button"
				accessibilityState={{ expanded }}
				accessibilityLabel={
					selectedIds.length > 0
						? `${selectedIds.length} selected: ${summary}`
						: placeholder
				}
			>
				<Text
					variant="body"
					color={selectedIds.length > 0 ? "text" : "textTertiary"}
					style={styles.summary}
					numberOfLines={2}
				>
					{summary}
				</Text>
				<Icon
					name={expanded ? "chevron-up" : "chevron-down"}
					size="sm"
					color="textSecondary"
				/>
			</Pressable>

			{expanded && (
				<View style={styles.panel}>
					{options.length > SEARCH_THRESHOLD && (
						<Input
							placeholder={searchPlaceholder}
							icon="search"
							value={search}
							onChangeText={setSearch}
							autoCapitalize="none"
							autoCorrect={false}
							containerStyle={styles.search}
						/>
					)}
					{list}
				</View>
			)}
		</View>
	);
};

const personPickerStyles = (theme: Theme) =>
	StyleSheet.create({
		control: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.sm,
			minHeight: theme.hitTarget,
			paddingHorizontal: theme.spacing.md,
			paddingVertical: theme.spacing.sm,
			borderRadius: theme.radius.md,
			borderWidth: theme.hairlineWidth,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.surfaceSunken,
		},
		summary: {
			flex: 1,
		},
		panel: {
			marginTop: theme.spacing.sm,
		},
		search: {
			marginBottom: theme.spacing.sm,
		},
		scroll: {
			maxHeight: MAX_LIST_HEIGHT,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.sm,
		},
		rowCheckbox: {
			flex: 1,
		},
	});
