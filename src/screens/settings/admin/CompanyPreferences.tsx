import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useCompany } from "../../../contexts/CompanyContext";
import {
	Card,
	Icon,
	ListRow,
	Pressable,
	Screen,
	ScreenHeader,
	SegmentedControl,
	SkeletonList,
	Text,
	toast,
	Toggle,
} from "../../../components/ui";
import { IconName } from "../../../components/ui/Icon";
import { haptics, Theme, useThemedStyles } from "../../../theme";

/*
 * Company-wide configuration.
 *
 * The four feature toggles each repeated the same `trackColor`/`thumbColor`
 * literal verbatim; they are `Toggle` rows now, so the switch is styled once.
 *
 * Toggling a flag here adds or removes a whole tab for every member of the
 * company — preferences are a live subscription — so each row says what it
 * actually does rather than naming the setting.
 */

type FlagKey =
	| "allowUserEventEditing"
	| "enableTimeSheet"
	| "enableAvailability"
	| "canViewEventLabels";

const FLAGS: {
	key: FlagKey;
	title: string;
	subtitle: string;
	icon: IconName;
}[] = [
	{
		key: "enableTimeSheet",
		title: "Time tracking",
		subtitle: "Adds the Clock tab and payroll review",
		icon: "time-outline",
	},
	{
		key: "enableAvailability",
		title: "Availability",
		subtitle: "Adds the Availability tab and worker groups",
		icon: "people-outline",
	},
	{
		key: "allowUserEventEditing",
		title: "Workers can suggest edits",
		subtitle: "Lets non-managers submit changes to an event",
		icon: "create-outline",
	},
	{
		key: "canViewEventLabels",
		title: "Workers see event labels",
		subtitle: "Shows your colour coding on their calendar",
		icon: "pricetag-outline",
	},
];

const CompanyPreferences = ({ navigation }) => {
	const styles = useThemedStyles(companyPrefStyles);
	const { company, preferences, isLoading, updatePreferences } = useCompany();
	const [copied, setCopied] = useState(false);

	const inviteCode = company?.accessCode || "";

	const handleCopyInviteCode = async () => {
		await Clipboard.setStringAsync(inviteCode);
		haptics.success();
		setCopied(true);
		toast.success("Invite code copied");
		setTimeout(() => setCopied(false), 2000);
	};

	const setFlag = (key: FlagKey, value: boolean) =>
		updatePreferences({ ...preferences, [key]: value });

	const header = (
		<ScreenHeader
			title="Company preferences"
			subtitle={company?.name || undefined}
			onBack={() => navigation.goBack()}
		/>
	);

	if (isLoading) {
		return (
			<Screen header={header}>
				<SkeletonList rows={6} />
			</Screen>
		);
	}

	return (
		<Screen scroll padded header={header}>
			<Card title="Invite code" style={styles.card}>
				<Text
					variant="caption"
					color="textSecondary"
					style={styles.hint}
				>
					Anyone with this code can join{" "}
					{company?.name || "the company"}.
				</Text>

				<Pressable
					onPress={handleCopyInviteCode}
					haptic={null}
					scaleOnPress={false}
					accessibilityLabel={`Copy invite code ${inviteCode}`}
					style={styles.codeChip}
				>
					<Text variant="heading" style={styles.code}>
						{inviteCode || "—"}
					</Text>
					<Icon
						name={copied ? "checkmark" : "copy-outline"}
						size="sm"
						color={copied ? "success" : "accent"}
					/>
				</Pressable>
			</Card>

			<Card title="Payroll" style={styles.card}>
				<Text
					variant="caption"
					color="textSecondary"
					style={styles.hint}
				>
					Which day a work week starts on. Drives the Clock tab and
					payroll totals.
				</Text>

				<SegmentedControl<"sunday" | "monday">
					segments={[
						{ value: "sunday", label: "Sunday" },
						{ value: "monday", label: "Monday" },
					]}
					value={preferences.workWeekStarts}
					onChange={(value) =>
						updatePreferences({
							...preferences,
							workWeekStarts: value,
						})
					}
				/>
			</Card>

			<Card title="Features" flush style={styles.card}>
				{FLAGS.map((flag, index) => (
					<ListRow
						key={flag.key}
						title={flag.title}
						subtitle={flag.subtitle}
						icon={flag.icon}
						separator={index < FLAGS.length - 1}
						accessory={
							<Toggle
								value={!!preferences[flag.key]}
								onValueChange={(value) =>
									setFlag(flag.key, value)
								}
							/>
						}
					/>
				))}
			</Card>

			<View style={styles.footnote}>
				<Text variant="caption" color="textTertiary" align="center">
					Feature changes reach everyone in the company immediately.
				</Text>
			</View>
		</Screen>
	);
};

export default CompanyPreferences;

const companyPrefStyles = (theme: Theme) =>
	StyleSheet.create({
		card: {
			marginTop: theme.spacing.lg,
		},
		hint: {
			marginBottom: theme.spacing.md,
		},
		codeChip: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: theme.spacing.md,
			paddingHorizontal: theme.spacing.lg,
			paddingVertical: theme.spacing.md,
			borderRadius: theme.radius.md,
			borderWidth: theme.hairlineWidth,
			borderColor: theme.colors.accentBorder,
			backgroundColor: theme.colors.accentSubtle,
		},
		code: {
			/* Monospace so an ambiguous character can be read back aloud. */
			fontFamily: "monospace",
			letterSpacing: 1,
		},
		footnote: {
			marginTop: theme.spacing.xl,
		},
	});
