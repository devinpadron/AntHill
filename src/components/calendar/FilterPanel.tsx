import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { FilterType } from "../../types/enums/FilterType";
import {
	Badge,
	Button,
	Checkbox,
	EmptyState,
	IconButton,
	Input,
	ListRow,
	Sheet,
	Text,
} from "../ui";
import { IconName } from "../ui/Icon";
import { Theme, useThemedStyles } from "../../theme";

export type WorkerOption = { label: string; value: string };

type FilterPanelProps = {
	filterType: FilterType;
	handleFilterChange: (type: FilterType) => void;
	bottomSheetRef: React.RefObject<BottomSheet>;
	bottomSheetPosition: number;
	handleSheetChanges: (index: number) => void;
	snapPoints: string[];
	selectedUsers: string[];
	setSelectedUsers: React.Dispatch<React.SetStateAction<string[]>>;
	/** Dropdown options, not membership records — {label, value} pairs. */
	availableWorkers: WorkerOption[];
	showAllSelectedOnly: boolean;
	setShowAllSelectedOnly: React.Dispatch<React.SetStateAction<boolean>>;
	showExactSelectedOnly: boolean;
	setShowExactSelectedOnly: React.Dispatch<React.SetStateAction<boolean>>;
	setFilterType: React.Dispatch<React.SetStateAction<FilterType>>;
	/** Grows the sheet when the worker list needs the room. */
	expandSheet: () => void;
	isAdmin?: boolean;
};

/*
 * The calendar's filters.
 *
 * The worker list arrives as a prop instead of being fetched here. v1 called
 * getAllUsersInCompany, which reads Companies/{c}/Users — a path that exists
 * only in the v1 schema, so a v2-only account has no document there and the
 * read is DENIED rather than empty. That is what logged "Error finding users"
 * on every calendar mount.
 *
 * The `react-native-dropdown-picker` multi-select is gone. It brought its own
 * white-on-white theme, its own badge styling and a `zIndex: 5000` that had to
 * be fought inside a bottom sheet — for a list of names with checkboxes. A
 * searchable list of rows does the same job with the app's own components, and
 * removes the 5-worker cap the picker imposed.
 */
export const FilterPanel: React.FC<FilterPanelProps> = ({
	filterType,
	handleFilterChange,
	bottomSheetRef,
	bottomSheetPosition,
	handleSheetChanges,
	snapPoints,
	selectedUsers,
	setSelectedUsers,
	availableWorkers,
	showAllSelectedOnly,
	setShowAllSelectedOnly,
	showExactSelectedOnly,
	setShowExactSelectedOnly,
	setFilterType,
	expandSheet,
}) => {
	const styles = useThemedStyles(filterStyles);
	const [search, setSearch] = useState("");

	const choosingUsers = filterType === FilterType.SPECIFIC;

	const filtered = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return availableWorkers;
		return availableWorkers.filter((w) =>
			w.label.toLowerCase().includes(term),
		);
	}, [availableWorkers, search]);

	const toggleUser = (value: string) =>
		setSelectedUsers((prev) =>
			prev.includes(value)
				? prev.filter((v) => v !== value)
				: [...prev, value],
		);

	const leaveUserPicker = () => {
		setShowAllSelectedOnly(false);
		setShowExactSelectedOnly(false);
		setSelectedUsers([]);
		setSearch("");
		setFilterType(FilterType.ALL);
	};

	const options: {
		type: FilterType;
		title: string;
		subtitle: string;
		icon: IconName;
	}[] = [
		{
			type: FilterType.MY,
			title: "My events",
			subtitle: "Only shifts you're scheduled on",
			icon: "person-outline",
		},
		{
			type: FilterType.ALL,
			title: "All events",
			subtitle: "Everything on the company calendar",
			icon: "albums-outline",
		},
		{
			type: FilterType.UNASSIGNED,
			title: "Unassigned",
			subtitle: "Events with nobody scheduled yet",
			icon: "help-circle-outline",
		},
		{
			type: FilterType.SPECIFIC,
			title: "Specific people",
			subtitle: "Pick who you want to see",
			icon: "people-outline",
		},
	];

	return (
		<Sheet
			ref={bottomSheetRef}
			snapPoints={snapPoints}
			index={bottomSheetPosition}
			onChange={handleSheetChanges}
			title={choosingUsers ? "Who do you want to see?" : "Filter events"}
			onClose={() => bottomSheetRef.current?.close()}
		>
			{choosingUsers ? (
				<View style={styles.flex}>
					<View style={styles.searchRow}>
						<IconButton
							name="arrow-back"
							onPress={leaveUserPicker}
							label="Back to filters"
						/>
						<Input
							placeholder="Search people"
							icon="search"
							value={search}
							onChangeText={setSearch}
							onFocus={expandSheet}
							autoCapitalize="none"
							autoCorrect={false}
							returnKeyType="search"
							containerStyle={styles.search}
						/>
					</View>

					{selectedUsers.length > 0 && (
						<View style={styles.selectedRow}>
							<Badge
								label={`${selectedUsers.length} selected`}
								tone="accent"
							/>
							<Button
								title="Clear"
								onPress={() => setSelectedUsers([])}
								variant="text"
								size="small"
							/>
						</View>
					)}

					<BottomSheetScrollView
						contentContainerStyle={styles.listContent}
						keyboardShouldPersistTaps="handled"
					>
						{filtered.length === 0 ? (
							<EmptyState
								icon="people-outline"
								title="Nobody matches that"
								description="Try a different name."
								compact
							/>
						) : (
							filtered.map((worker) => (
								<ListRow
									key={worker.value}
									title={worker.label}
									onPress={() => toggleUser(worker.value)}
									accessory={
										<Checkbox
											checked={selectedUsers.includes(
												worker.value,
											)}
											onPress={() =>
												toggleUser(worker.value)
											}
										/>
									}
								/>
							))
						)}
					</BottomSheetScrollView>

					{/*
					 * Only meaningful with more than one person picked: they
					 * narrow "any of these" to "all of these on the same event".
					 */}
					{selectedUsers.length > 1 && (
						<View style={styles.modifiers}>
							<Checkbox
								checked={showAllSelectedOnly}
								onPress={() => {
									setShowAllSelectedOnly((prev) => !prev);
									if (!showAllSelectedOnly) {
										setShowExactSelectedOnly(false);
									}
								}}
								label="Working together"
								description="Events where all of them are scheduled"
							/>
							<Checkbox
								checked={showExactSelectedOnly}
								onPress={() => {
									setShowExactSelectedOnly((prev) => !prev);
									if (!showExactSelectedOnly) {
										setShowAllSelectedOnly(false);
									}
								}}
								label="Exclusively together"
								description="…and nobody else is"
							/>
						</View>
					)}

					<View style={styles.footer}>
						<Button
							title={
								selectedUsers.length
									? `Show ${selectedUsers.length} ${selectedUsers.length === 1 ? "person" : "people"}`
									: "Pick at least one person"
							}
							onPress={() =>
								handleFilterChange(FilterType.SPECIFIC)
							}
							disabled={selectedUsers.length === 0}
							icon="checkmark"
							fullWidth
							haptic="press"
						/>
					</View>
				</View>
			) : (
				<View style={styles.optionList}>
					{options.map((option, index) => (
						<ListRow
							key={option.type}
							title={option.title}
							subtitle={option.subtitle}
							icon={option.icon}
							iconColor={
								filterType === option.type
									? "accent"
									: "textSecondary"
							}
							selected={filterType === option.type}
							separator={index < options.length - 1}
							onPress={() =>
								option.type === FilterType.SPECIFIC
									? setFilterType(FilterType.SPECIFIC)
									: handleFilterChange(option.type)
							}
							chevron={option.type === FilterType.SPECIFIC}
						/>
					))}

					<Text
						variant="caption"
						color="textTertiary"
						align="center"
						style={styles.hint}
					>
						Your default filter lives in User Preferences.
					</Text>
				</View>
			)}
		</Sheet>
	);
};

const filterStyles = (theme: Theme) =>
	StyleSheet.create({
		flex: {
			flex: 1,
		},
		optionList: {
			paddingTop: theme.spacing.sm,
		},
		hint: {
			marginTop: theme.spacing.lg,
			paddingHorizontal: theme.spacing.xl,
		},
		searchRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.sm,
			paddingHorizontal: theme.spacing.md,
			paddingTop: theme.spacing.md,
		},
		search: {
			flex: 1,
		},
		selectedRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: theme.spacing.lg,
			paddingTop: theme.spacing.md,
		},
		listContent: {
			paddingTop: theme.spacing.md,
			paddingBottom: theme.spacing.lg,
		},
		modifiers: {
			paddingHorizontal: theme.spacing.lg,
			paddingVertical: theme.spacing.sm,
			borderTopWidth: theme.hairlineWidth,
			borderTopColor: theme.colors.border,
		},
		footer: {
			paddingHorizontal: theme.spacing.lg,
			paddingTop: theme.spacing.md,
			borderTopWidth: theme.hairlineWidth,
			borderTopColor: theme.colors.border,
		},
	});
