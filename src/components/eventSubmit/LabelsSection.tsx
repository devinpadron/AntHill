import React from "react";
import {
	View,
	TouchableOpacity,
	ActivityIndicator,
	StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, BorderRadius, IconSize } from "../../constants/tokens";

type LabelItem = {
	id: string;
	name: string;
	color: string;
};

type LabelsSectionProps = {
	availableLabels: LabelItem[];
	selectedLabelId: string | null;
	onSelectLabel: (id: string | null) => void;
	loadingLabels: boolean;
};

export const LabelsSection = ({
	availableLabels,
	selectedLabelId,
	onSelectLabel,
	loadingLabels,
}: LabelsSectionProps) => {
	const { theme } = useTheme();

	const selectedLabel = availableLabels.find((l) => l.id === selectedLabelId);

	const renderContent = () => {
		if (loadingLabels) {
			return (
				<ActivityIndicator
					color={theme.LocationBlue}
					style={{ marginVertical: Spacing.md }}
				/>
			);
		}

		if (availableLabels.length === 0) {
			return (
				<View
					style={[
						styles.emptyContainer,
						{
							backgroundColor: theme.DateBadge,
							borderColor: theme.BorderColor,
						},
					]}
				>
					<Text variant="body" color="tertiary">
						No labels available
					</Text>
				</View>
			);
		}

		return (
			<View style={styles.selectorContainer}>
				<View style={styles.labelsGrid}>
					{/* None option */}
					<TouchableOpacity
						style={[
							styles.labelOption,
							{
								backgroundColor: theme.DateBadge,
								borderColor: theme.BorderColor,
							},
							!selectedLabelId && [
								styles.labelOptionSelected,
								{ borderColor: theme.LocationBlue },
							],
						]}
						onPress={() => onSelectLabel(null)}
					>
						<View
							style={[
								styles.labelColorNone,
								{ backgroundColor: theme.BorderColor },
							]}
						>
							<Ionicons
								name="close"
								size={IconSize.xs}
								color={theme.TertiaryText}
							/>
						</View>
						<Text variant="caption" color="primary">
							None
						</Text>
					</TouchableOpacity>

					{/* Available labels */}
					{availableLabels.map((label) => (
						<TouchableOpacity
							key={label.id}
							style={[
								styles.labelOption,
								{
									backgroundColor: theme.DateBadge,
									borderColor: theme.BorderColor,
								},
								selectedLabelId === label.id && [
									styles.labelOptionSelected,
									{ borderColor: theme.LocationBlue },
								],
							]}
							onPress={() => onSelectLabel(label.id)}
						>
							<View
								style={[
									styles.labelColor,
									{ backgroundColor: label.color },
								]}
							/>
							<Text variant="caption" color="primary">
								{label.name}
							</Text>
						</TouchableOpacity>
					))}
				</View>
			</View>
		);
	};

	return (
		<View
			style={[
				styles.section,
				{ borderBottomColor: theme.BorderColor, zIndex: 1 },
			]}
		>
			<Text
				variant="h3"
				weight="bold"
				color="primary"
				style={styles.sectionTitle}
			>
				Label
			</Text>
			<View style={styles.inputContainer}>
				<Text
					variant="body"
					weight="medium"
					color="secondary"
					style={styles.label}
				>
					Event Label
				</Text>
				<Text
					variant="caption"
					color="secondary"
					style={styles.helperText}
				>
					Categorize this event with a label
				</Text>
				{renderContent()}

				{/* Selected Label Preview */}
				{selectedLabel && (
					<View style={styles.selectedLabelContainer}>
						<View
							style={[
								styles.selectedLabel,
								{ backgroundColor: selectedLabel.color },
							]}
						>
							<Text
								variant="caption"
								weight="medium"
								style={styles.selectedLabelText}
							>
								{selectedLabel.name}
							</Text>
						</View>
					</View>
				)}
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
	helperText: {
		marginBottom: Spacing.md,
	},
	emptyContainer: {
		padding: Spacing.lg,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderStyle: "dashed",
		marginVertical: Spacing.sm,
	},
	selectorContainer: {
		marginTop: Spacing.sm,
		marginBottom: Spacing.sm,
	},
	labelsGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
	},
	labelOption: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.xl,
		marginRight: Spacing.sm,
		marginBottom: Spacing.sm,
		borderWidth: 1,
		minHeight: 36,
	},
	labelOptionSelected: {
		borderWidth: 2,
	},
	labelColor: {
		width: 18,
		height: 18,
		borderRadius: 9,
		marginRight: Spacing.sm,
	},
	labelColorNone: {
		width: 18,
		height: 18,
		borderRadius: 9,
		marginRight: Spacing.sm,
		alignItems: "center",
		justifyContent: "center",
	},
	selectedLabelContainer: {
		marginTop: Spacing.lg,
		paddingTop: Spacing.sm,
	},
	selectedLabel: {
		paddingHorizontal: Spacing.md,
		paddingVertical: 6,
		borderRadius: BorderRadius.xl,
		alignSelf: "flex-start",
		marginTop: Spacing.xs,
	},
	selectedLabelText: {
		color: "white",
		textShadowColor: "rgba(0, 0, 0, 0.3)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},
});
