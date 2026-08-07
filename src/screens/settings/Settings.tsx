import React from "react";
import { Alert, StyleSheet, View } from "react-native";
import { ExpandableSettingsSection } from "../../components/settings/ExpandableSettingsSection";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import {
	Card,
	ListRow,
	Screen,
	ScreenHeader,
	SkeletonList,
	Text,
} from "../../components/ui";
import { Theme, useThemedStyles } from "../../theme";

/*
 * The settings hub.
 *
 * Now scrollable — it was a plain View, so on a small phone an admin's list ran
 * off the bottom with no way to reach Log Out. Loading shows skeleton rows
 * rather than `return null`, which rendered a blank screen.
 */
const Settings = ({ navigation }: any) => {
	const { isAdmin, logout } = useUser();
	const { preferences, isLoading } = useCompany();

	const handleLogout = () => {
		Alert.alert("Log out?", "You'll need to sign in again.", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Log out",
				style: "destructive",
				onPress: async () => {
					try {
						await logout();
					} catch (error) {
						console.error("Signout Error", error);
					}
				},
			},
		]);
	};

	const header = <ScreenHeader variant="large" title="Settings" />;

	if (isLoading) {
		return (
			<Screen header={header}>
				<SkeletonList rows={6} />
			</Screen>
		);
	}

	return (
		<Screen scroll padded header={header}>
			<Section title="Account">
				<ListRow
					multiline
					title="Profile"
					subtitle="Your name, email and companies"
					icon="person-outline"
					onPress={() => navigation.push("Profile")}
				/>
				<ListRow
					multiline
					title="Preferences"
					subtitle="Appearance, maps and defaults"
					icon="options-outline"
					onPress={() => navigation.push("UserPreferences")}
				/>
				{/* Everyone's own numbers — deliberately outside the admin block. */}
				<ListRow
					multiline
					title="Statistics"
					subtitle="Your hours, shifts and records"
					icon="stats-chart-outline"
					onPress={() => navigation.push("Statistics")}
					separator={false}
				/>
			</Section>

			{isAdmin && (
				<>
					<Section title="Company">
						<ListRow
							multiline
							title="Company preferences"
							subtitle="Features, invite code and week start"
							icon="business-outline"
							onPress={() =>
								navigation.push("CompanyPreferences")
							}
						/>
						<ListRow
							multiline
							title="Employees"
							subtitle="Roster, roles and access"
							icon="people-outline"
							onPress={() => navigation.push("EmployeeList")}
							separator={
								preferences.enableAvailability ||
								preferences.enableTimeSheet
							}
						/>
						{preferences.enableAvailability && (
							<ListRow
								multiline
								title="Worker groups"
								subtitle="Publish events to a subset of the crew"
								icon="git-branch-outline"
								onPress={() => navigation.push("WorkerGroups")}
								separator={preferences.enableTimeSheet}
							/>
						)}
						{preferences.enableTimeSheet && (
							<ListRow
								multiline
								title="Payroll review"
								subtitle="Approve and export hours"
								icon="cash-outline"
								onPress={() => navigation.push("PayrollReview")}
								separator={false}
							/>
						)}
					</Section>

					<Section title="Build">
						<ExpandableSettingsSection title="Forms, checklists & labels">
							<ListRow
								multiline
								title="Timesheet form"
								icon="document-text-outline"
								onPress={() =>
									navigation.push("CompanyCustomForm", {
										isEventForm: false,
									})
								}
							/>
							<ListRow
								multiline
								title="Event form"
								icon="document-text-outline"
								onPress={() =>
									navigation.push("CompanyCustomForm", {
										isEventForm: true,
									})
								}
							/>
							<ListRow
								multiline
								title="Checklists"
								icon="checkbox-outline"
								onPress={() =>
									navigation.push("ChecklistCreator")
								}
							/>
							<ListRow
								multiline
								title="Packages"
								icon="cube-outline"
								onPress={() =>
									navigation.push("PackageCreator")
								}
							/>
							<ListRow
								multiline
								title="Event labels"
								icon="pricetag-outline"
								onPress={() => navigation.push("LabelCreator")}
								separator={false}
							/>
						</ExpandableSettingsSection>
					</Section>
				</>
			)}

			<Section title="Account actions">
				<ListRow
					multiline
					title="Log out"
					icon="log-out-outline"
					destructive
					chevron={false}
					onPress={handleLogout}
					separator={false}
				/>
			</Section>
		</Screen>
	);
};

/** A labelled group of rows. */
const Section = ({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) => {
	const styles = useThemedStyles(settingsStyles);

	return (
		<View style={styles.section}>
			<Text
				variant="overline"
				color="textSecondary"
				uppercase
				style={styles.sectionTitle}
			>
				{title}
			</Text>
			<Card flush>{children}</Card>
		</View>
	);
};

export default Settings;

const settingsStyles = (theme: Theme) =>
	StyleSheet.create({
		section: {
			marginTop: theme.spacing.xl,
		},
		sectionTitle: {
			marginBottom: theme.spacing.sm,
			marginLeft: theme.spacing.xs,
		},
	});
