import React from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Icon, Text } from "../ui";
import { IconName } from "../ui/Icon";
import { Theme, useThemedStyles } from "../../theme";

/*
 * The disclosure, shown before the OS ever asks for anything.
 *
 * This is not decoration and it is not a formality. Google Play requires a
 * prominent in-app disclosure BEFORE the background location prompt, several US
 * states require an employee be told before their location is tracked at work,
 * and independently of both: a worker whose employer is about to start
 * recording where they go is owed a plain account of it in language they can
 * read.
 *
 * So the copy states four things, and any edit has to keep all four:
 *   what is recorded, when it starts and stops, who sees it, and that saying no
 *   is allowed and does not affect their ability to clock in.
 *
 * It is deliberately NOT dismissible by tapping outside or swiping down. Both
 * of those produce an answer without a decision, and "they didn't say no" is
 * not consent.
 */

type LocationConsentSheetProps = {
	visible: boolean;
	companyName: string;
	onAccept: () => void;
	onDecline: () => void;
	/**
	 * Whether the company lets a worker refuse.
	 *
	 * False turns the sheet from a choice into a notice: the disclosure still
	 * appears in full and still precedes every OS prompt, because Play requires
	 * that of the app as a whole, but the only button is OK. The copy changes
	 * with it — promising a choice and then not offering one is worse than
	 * saying plainly that this is a condition of the job.
	 */
	allowDeclining?: boolean;
	/** Whether to promise the worker sight of their own route. */
	workersSeeOwnRoutes?: boolean;
};

type Point = { icon: IconName; title: string; body: string };

const BASE_POINTS: Point[] = [
	{
		icon: "time-outline",
		title: "Only while you're on the clock",
		body: "Recording starts when you clock in and stops when you clock out. Nothing is recorded on your own time, and pausing for a break pauses recording too.",
	},
	{
		icon: "map-outline",
		title: "Your route during the shift",
		body: "Your position is saved every so often while you work, including when the app is closed, so the shift can be shown as a route on a map.",
	},
];

/*
 * The last two points depend on company configuration, because each one makes a
 * promise the app then has to keep. Stating "you can see your own route" to
 * someone whose employer has switched that off is the sheet lying at the exact
 * moment it is asking to be trusted.
 */
const SEE_OWN: Point = {
	icon: "eye-outline",
	title: "You and your managers can see it",
	body: "The route is attached to that shift's timesheet. You can see your own, and managers at this company can see it when they review your hours. Your co-workers cannot.",
};

const MANAGERS_ONLY: Point = {
	icon: "eye-outline",
	title: "Your managers can see it",
	body: "The route is attached to that shift's timesheet, and managers at this company can see it when they review your hours. You will not be shown your own route, and your co-workers cannot see it.",
};

const CAN_DECLINE: Point = {
	icon: "hand-left-outline",
	title: "You can say no",
	body: "Declining does not stop you clocking in, and it does not affect your hours. Your manager will see that no route was recorded.",
};

const CANNOT_DECLINE: Point = {
	icon: "information-circle-outline",
	title: "This one isn't optional here",
	body: "Your employer has made location recording a condition of clocking in at this company. You can still refuse in your phone's settings, and your manager will see that no route was recorded.",
};

export const LocationConsentSheet: React.FC<LocationConsentSheetProps> = ({
	visible,
	companyName,
	onAccept,
	onDecline,
	allowDeclining = true,
	workersSeeOwnRoutes = true,
}) => {
	const styles = useThemedStyles(consentStyles);
	const insets = useSafeAreaInsets();

	const points: Point[] = [
		...BASE_POINTS,
		workersSeeOwnRoutes ? SEE_OWN : MANAGERS_ONLY,
		allowDeclining ? CAN_DECLINE : CANNOT_DECLINE,
	];

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			/*
			 * Android's back button maps to onRequestClose. Routed to DECLINE
			 * rather than to a silent dismiss, so every way out of this screen
			 * is an actual answer that gets recorded — and to nothing at all
			 * where declining is not on offer, since a back press must not
			 * become the opt-out the buttons deliberately do not provide.
			 */
			onRequestClose={allowDeclining ? onDecline : undefined}
		>
			<View style={styles.backdrop}>
				<View
					style={[
						styles.sheet,
						{ paddingBottom: insets.bottom + 16 },
					]}
				>
					<View style={styles.header}>
						<View style={styles.iconWell}>
							<Icon
								name="location-outline"
								size="lg"
								color="accent"
							/>
						</View>
						<Text variant="title" align="center">
							{allowDeclining
								? `${companyName} wants to track your location at work`
								: `${companyName} tracks your location at work`}
						</Text>
					</View>

					<ScrollView
						style={styles.scroll}
						contentContainerStyle={styles.scrollContent}
						showsVerticalScrollIndicator={false}
					>
						{points.map((point) => (
							<View key={point.title} style={styles.point}>
								<Icon
									name={point.icon}
									size="sm"
									color="textSecondary"
								/>
								<View style={styles.pointText}>
									<Text variant="bodyStrong">
										{point.title}
									</Text>
									<Text
										variant="caption"
										color="textSecondary"
									>
										{point.body}
									</Text>
								</View>
							</View>
						))}
					</ScrollView>

					<View style={styles.actions}>
						<Button
							title={
								allowDeclining
									? "Allow location tracking"
									: "Continue"
							}
							onPress={onAccept}
							fullWidth
							haptic="success"
						/>
						{/*
						 * Absent, not disabled, when the company does not allow
						 * a refusal. A greyed-out "Not now" reads as a bug and
						 * invites people to keep tapping it; the copy above
						 * already says why there is no second button.
						 */}
						{allowDeclining && (
							<Button
								title="Not now"
								onPress={onDecline}
								variant="text"
								fullWidth
							/>
						)}
					</View>
				</View>
			</View>
		</Modal>
	);
};

const consentStyles = (theme: Theme) =>
	StyleSheet.create({
		backdrop: {
			flex: 1,
			justifyContent: "flex-end",
			backgroundColor: theme.colors.overlay,
		},
		sheet: {
			backgroundColor: theme.colors.surface,
			borderTopLeftRadius: theme.radius.xl,
			borderTopRightRadius: theme.radius.xl,
			paddingTop: theme.spacing.xl,
			paddingHorizontal: theme.spacing.lg,
			maxHeight: "88%",
		},
		header: {
			alignItems: "center",
			gap: theme.spacing.md,
			marginBottom: theme.spacing.lg,
		},
		iconWell: {
			width: 56,
			height: 56,
			borderRadius: theme.radius.pill,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: theme.colors.accentSubtle,
		},
		scroll: {
			flexGrow: 0,
		},
		scrollContent: {
			gap: theme.spacing.lg,
			paddingBottom: theme.spacing.lg,
		},
		point: {
			flexDirection: "row",
			gap: theme.spacing.md,
		},
		pointText: {
			flex: 1,
			gap: theme.spacing.xs,
		},
		actions: {
			gap: theme.spacing.sm,
			paddingTop: theme.spacing.md,
			borderTopWidth: theme.hairlineWidth,
			borderTopColor: theme.colors.border,
		},
	});
