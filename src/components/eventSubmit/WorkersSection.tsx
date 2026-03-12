import React from "react";
import { View, StyleSheet } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, BorderRadius } from "../../constants/tokens";

type WorkerItem = {
	label: string;
	value: string;
	userData: any;
	status?: string;
};

type WorkersSectionProps = {
	assignedWorkers: string[];
	setAssignedWorkers: (v: any) => void;
	availableWorkers: WorkerItem[];
	setAvailableWorkers: (v: any) => void;
	open: boolean;
	onToggle: () => void;
};

export const WorkersSection = ({
	assignedWorkers,
	setAssignedWorkers,
	availableWorkers,
	setAvailableWorkers,
	open,
	onToggle,
}: WorkersSectionProps) => {
	const { theme } = useTheme();

	return (
		<View
			style={[styles.section, { borderBottomColor: theme.BorderColor }]}
		>
			<Text
				variant="h3"
				weight="bold"
				color="primary"
				style={styles.sectionTitle}
			>
				People
			</Text>
			<View
				style={[styles.inputContainer, { zIndex: 3000, elevation: 3 }]}
			>
				<Text
					variant="body"
					weight="medium"
					color="secondary"
					style={styles.label}
				>
					Assigned Workers
				</Text>
				<DropDownPicker
					searchPlaceholder="Search workers"
					multiple={true}
					min={0}
					max={5}
					value={assignedWorkers}
					setValue={setAssignedWorkers}
					items={availableWorkers}
					setItems={setAvailableWorkers}
					open={open}
					setOpen={onToggle}
					mode="BADGE"
					listMode="SCROLLVIEW"
					searchable={true}
					maxHeight={200}
					style={[
						styles.dropdown,
						{
							borderColor: theme.BorderColor,
							backgroundColor: theme.CardBackground,
						},
					]}
					dropDownContainerStyle={[
						styles.dropdownList,
						{
							borderColor: theme.BorderColor,
							backgroundColor: theme.CardBackground,
						},
					]}
					listItemContainerStyle={[
						styles.dropdownItem,
						{ borderBottomColor: theme.BorderColor },
					]}
					badgeColors={[theme.LocationBlue]}
					badgeTextStyle={{ color: "white" }}
					zIndex={3000}
					placeholder="Select workers"
					textStyle={{ color: theme.PrimaryText }}
					placeholderStyle={{ color: theme.TertiaryText }}
				/>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	section: {
		padding: Spacing.lg,
		borderBottomWidth: 1,
	},
	sectionTitle: {
		marginBottom: Spacing.lg,
	},
	inputContainer: {
		marginBottom: Spacing.lg,
	},
	label: {
		marginBottom: Spacing.sm,
	},
	dropdown: {
		borderWidth: 1,
		borderRadius: BorderRadius.md,
		minHeight: 50,
	},
	dropdownList: {
		borderWidth: 1,
		borderRadius: BorderRadius.md,
		marginTop: 1,
		position: "relative",
		top: 0,
	},
	dropdownItem: {
		borderBottomWidth: 1,
		minHeight: 40,
		justifyContent: "center",
	},
});
