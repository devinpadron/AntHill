import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../ui/Card";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, IconSize, BorderRadius } from "../../constants/tokens";

interface PackagesCardProps {
	packages: any[];
	totalChecklists: number;
	eventId: string;
	onNavigateChecklists: (checklistIds: string[], eventId: string) => void;
}

/**
 * PackagesCard - Displays event packages with checklist previews
 */
export const PackagesCard: React.FC<PackagesCardProps> = ({
	packages,
	totalChecklists,
	eventId,
	onNavigateChecklists,
}) => {
	const { theme } = useTheme();

	if (packages.length === 0) return null;

	const getChecklistIds = (checklists: any[]) =>
		checklists.map((checklist) =>
			typeof checklist === "string" ? checklist : checklist.checklistId,
		);

	return (
		<Card padding="md" elevation="md" style={styles.card}>
			<View style={styles.sectionHeaderContainer}>
				<Ionicons
					name="cube-outline"
					size={IconSize.sm}
					color={theme.LocationBlue}
					style={styles.icon}
				/>
				<Text variant="body" weight="semibold" color="primary">
					Packages
					{totalChecklists > 0 && (
						<Text variant="caption" color="secondary">
							{" · "}
							{totalChecklists} checklists
						</Text>
					)}
				</Text>
			</View>

			{packages.map((pkg, index) => (
				<View
					key={pkg.id}
					style={[
						styles.packageCard,
						{
							backgroundColor: theme.DateBadge,
							borderColor: theme.BorderColor,
						},
						index < packages.length - 1 && styles.packageCardMargin,
					]}
				>
					<View style={styles.packageHeader}>
						<Text
							variant="body"
							weight="semibold"
							color="primary"
							style={styles.packageTitle}
						>
							{pkg.title}
						</Text>

						{pkg.checklists && pkg.checklists.length > 0 && (
							<TouchableOpacity
								style={[
									styles.checklistButton,
									{
										backgroundColor:
											theme.LocationBlue + "20",
									},
								]}
								onPress={() =>
									onNavigateChecklists(
										getChecklistIds(pkg.checklists),
										eventId,
									)
								}
							>
								<Ionicons
									name="list"
									size={18}
									color={theme.LocationBlue}
								/>
								<Text
									variant="caption"
									weight="medium"
									color="info"
									style={styles.checklistButtonText}
								>
									{pkg.checklists.length}
								</Text>
							</TouchableOpacity>
						)}
					</View>

					{pkg.description ? (
						<Text
							variant="caption"
							color="secondary"
							style={styles.packageDescription}
						>
							{pkg.description}
						</Text>
					) : null}

					{/* Show first 2 checklists */}
					{pkg.checklists && pkg.checklists.length > 0 && (
						<View
							style={[
								styles.packageChecklists,
								{ backgroundColor: theme.Background },
							]}
						>
							{pkg.checklists.slice(0, 2).map((checklist) => (
								<View
									key={
										typeof checklist === "string"
											? checklist
											: checklist.checklistId
									}
									style={styles.packageChecklistItem}
								>
									<Ionicons
										name="checkbox-outline"
										size={IconSize.xs}
										color={theme.NotificationGreen}
										style={styles.checklistIcon}
									/>
									<Text
										variant="caption"
										color="primary"
										numberOfLines={1}
									>
										{checklist.title || "Checklist"}
									</Text>
								</View>
							))}
							{pkg.checklists.length > 2 && (
								<Text
									variant="small"
									color="secondary"
									italic
									style={styles.moreChecklists}
								>
									+{pkg.checklists.length - 2} more
								</Text>
							)}
						</View>
					)}
				</View>
			))}
		</Card>
	);
};

const styles = StyleSheet.create({
	card: {
		marginBottom: Spacing.lg,
	},
	sectionHeaderContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: Spacing.md,
	},
	icon: {
		marginRight: Spacing.sm,
	},
	packageCard: {
		borderRadius: BorderRadius.md + 2,
		padding: 14,
		borderWidth: 1,
	},
	packageCardMargin: {
		marginBottom: Spacing.md,
	},
	packageHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: Spacing.sm,
	},
	packageTitle: {
		flex: 1,
	},
	packageDescription: {
		marginBottom: Spacing.md - 2,
		lineHeight: 20,
	},
	checklistButton: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: Spacing.xs,
		paddingHorizontal: Spacing.sm,
		borderRadius: BorderRadius.xl,
	},
	checklistButtonText: {
		marginLeft: Spacing.xs,
	},
	packageChecklists: {
		marginTop: Spacing.md - 2,
		borderRadius: BorderRadius.md,
		padding: Spacing.md - 2,
	},
	packageChecklistItem: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 6,
	},
	checklistIcon: {
		marginRight: Spacing.sm,
	},
	moreChecklists: {
		marginTop: Spacing.xs,
	},
});
