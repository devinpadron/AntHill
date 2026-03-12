import React from "react";
import {
	View,
	TouchableOpacity,
	ActivityIndicator,
	StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DropDownPicker from "react-native-dropdown-picker";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, BorderRadius, IconSize } from "../../constants/tokens";

type PackagesSectionProps = {
	availablePackages: any[];
	selectedPackages: string[];
	loadingPackages: boolean;
	openDropdown: boolean;
	setOpenDropdown: React.Dispatch<React.SetStateAction<boolean>>;
	onTogglePackage: (id: string) => void;
};

export const PackagesSection = ({
	availablePackages,
	selectedPackages,
	loadingPackages,
	openDropdown,
	setOpenDropdown,
	onTogglePackage,
}: PackagesSectionProps) => {
	const { theme } = useTheme();

	const renderContent = () => {
		if (loadingPackages) {
			return (
				<ActivityIndicator
					color={theme.LocationBlue}
					style={{ marginVertical: Spacing.xl }}
				/>
			);
		}

		if (availablePackages.length === 0) {
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
						No packages available
					</Text>
				</View>
			);
		}

		return (
			<>
				<DropDownPicker
					open={openDropdown}
					setOpen={setOpenDropdown}
					items={availablePackages.map((pkg) => ({
						label: pkg.title,
						value: pkg.id,
					}))}
					value={[]}
					setValue={() => {}}
					multiple={false}
					searchable={true}
					searchPlaceholder="Search packages..."
					placeholder="Select a package"
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
					listMode="SCROLLVIEW"
					maxHeight={300}
					onSelectItem={(item) => {
						if (item && !selectedPackages.includes(item.value)) {
							onTogglePackage(item.value);
						}
						setOpenDropdown(false);
					}}
					zIndex={2000}
					textStyle={{ color: theme.PrimaryText }}
					placeholderStyle={{ color: theme.TertiaryText }}
				/>

				{selectedPackages.length > 0 && (
					<View
						style={[
							styles.selectedContainer,
							{ borderTopColor: theme.BorderColor },
						]}
					>
						<Text
							variant="body"
							weight="semibold"
							color="primary"
							style={styles.selectedTitle}
						>
							Selected Packages ({selectedPackages.length})
						</Text>
						{availablePackages
							.filter((pkg) => selectedPackages.includes(pkg.id))
							.map((pkg) => (
								<View
									key={pkg.id}
									style={[
										styles.packageItem,
										{
											backgroundColor: theme.DateBadge,
											borderColor: theme.BorderColor,
										},
									]}
								>
									<View style={styles.packageItemContent}>
										<View style={styles.packageItemHeader}>
											<Text
												variant="body"
												weight="semibold"
												color="primary"
												style={styles.packageTitle}
											>
												{pkg.title}
											</Text>
											<TouchableOpacity
												onPress={() =>
													onTogglePackage(pkg.id)
												}
												style={styles.removeButton}
											>
												<Ionicons
													name="close-circle"
													size={IconSize.md}
													color="#e74c3c"
												/>
											</TouchableOpacity>
										</View>

										{pkg.description ? (
											<Text
												variant="caption"
												color="secondary"
												numberOfLines={2}
												style={
													styles.packageDescription
												}
											>
												{pkg.description}
											</Text>
										) : null}

										<Text
											variant="caption"
											color="tertiary"
										>
											{pkg.checklists.length}{" "}
											{pkg.checklists.length === 1
												? "checklist"
												: "checklists"}
										</Text>
									</View>
								</View>
							))}
					</View>
				)}
			</>
		);
	};

	return (
		<View
			style={[
				styles.section,
				{ borderBottomColor: theme.BorderColor, zIndex: 2 },
			]}
		>
			<Text
				variant="h3"
				weight="bold"
				color="primary"
				style={styles.sectionTitle}
			>
				Packages
			</Text>
			<View style={styles.inputContainer}>
				<Text
					variant="body"
					weight="medium"
					color="secondary"
					style={styles.label}
				>
					Attach Packages
				</Text>
				<Text
					variant="caption"
					color="secondary"
					style={styles.helperText}
				>
					Select packages to attach to this event
				</Text>
				{renderContent()}
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
	emptyContainer: {
		padding: Spacing.xl,
		borderRadius: BorderRadius.md,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderStyle: "dashed",
	},
	selectedContainer: {
		marginTop: Spacing.lg,
		borderTopWidth: 1,
		paddingTop: Spacing.lg,
	},
	selectedTitle: {
		marginBottom: Spacing.md,
	},
	packageItem: {
		borderRadius: BorderRadius.md,
		marginBottom: Spacing.md,
		borderWidth: 1,
		overflow: "hidden",
	},
	packageItemContent: {
		padding: Spacing.md,
	},
	packageItemHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: Spacing.sm,
	},
	packageTitle: {
		flex: 1,
	},
	packageDescription: {
		marginBottom: Spacing.sm,
	},
	removeButton: {
		padding: Spacing.xs,
	},
});
