import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import moment from "moment";
import MapView, { Marker } from "react-native-maps";

// Custom hooks and utilities
import { AcknowledgeShiftBanner } from "../../components/calendar/AcknowledgeShiftBanner";
import { useEventDetails } from "../../hooks/useEventDetails";
import { getRegionForMarkers, openMap, MapMarker } from "../../utils/mapUtils";

// Components
import AttachmentGallery from "../../components/ui/AttachmentGallery";
import {
	Badge,
	Button,
	Card,
	FAB,
	FABStack,
	Icon,
	IconButton,
	Input,
	Loading,
	Screen,
	ScreenHeader,
	Text,
	toast,
} from "../../components/ui";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import { Theme, useTheme, useThemedStyles } from "../../theme";

/*
 * Read-only view of an event.
 *
 * Two things changed beyond the restyle. The header is pinned rather than
 * scrolling away with the content — it used to sit inside the ScrollView. And
 * personal notes are edited by tapping a pencil: the previous version listened
 * for a double tap on the note body (a hand-rolled `Date.now()` comparison that
 * toggled `editable` and `pointerEvents`), which nothing on screen announced.
 */

type RootStackParamList = {
	EventDetails: { eventId: string };
};

type EventDetailsRouteProp = RouteProp<RootStackParamList, "EventDetails">;

const EventDetails = ({ navigation }) => {
	const theme = useTheme();
	const styles = useThemedStyles(detailStyles);
	const route = useRoute<EventDetailsRouteProp>();

	const eventId = route.params?.eventId;
	const [markers, setMarkers] = useState<MapMarker[]>([]);
	const [initialRegion, setInitialRegion] = useState(null);
	const [isEditingNotes, setIsEditingNotes] = useState(false);

	const { settings, isAdmin } = useUser();
	const prefMap = settings?.preferredMapApp || "";
	const { preferences } = useCompany();

	const {
		event,
		attachments,
		workerList,
		localNotes,
		setLocalNotes,
		isLoading,
		saveNotes,
		hasEditPermission,
		packages,
		eventLabel,
		myAcknowledgement,
		acknowledge,
	} = useEventDetails(eventId);

	/*
	 * v1 bumped a refreshKey on focus to re-fetch the event, attachments and
	 * worker names, because all three were one-shot reads. Every one of them is
	 * a live subscription now, so the screen is already current on focus.
	 */

	// Process location data
	useEffect(() => {
		if (!event?.locations) return;

		const locationMarkers: MapMarker[] = [];

		for (let location in event.locations) {
			locationMarkers.push({
				latitude: event.locations[location].latitude,
				longitude: event.locations[location].longitude,
				title: location,
				label: event.locations[location].label,
			});
		}

		setMarkers(locationMarkers);
	}, [event]);

	// Calculate map region when markers change
	useEffect(() => {
		if (markers.length > 0) {
			setInitialRegion(getRegionForMarkers(markers));
		}
	}, [markers]);

	/* Every checklist across every package, deduped — what the FAB opens. */
	const allChecklistIds = useMemo(
		() =>
			Array.from(
				new Set(
					packages
						.flatMap((pkg) =>
							(pkg.checklists ?? []).map((checklist) =>
								typeof checklist === "string"
									? checklist
									: checklist.id,
							),
						)
						.filter(Boolean),
				),
			),
		[packages],
	);

	const totalChecklists = packages.reduce(
		(total, pkg) => total + (pkg.checklists?.length || 0),
		0,
	);

	/** Package ids whose description the reader has asked to see. */
	const [shownDescriptions, setShownDescriptions] = useState<string[]>([]);

	const toggleDescription = (packageId: string) =>
		setShownDescriptions((prev) =>
			prev.includes(packageId)
				? prev.filter((id) => id !== packageId)
				: [...prev, packageId],
		);

	const finishEditingNotes = () => {
		saveNotes();
		setIsEditingNotes(false);
		toast.success("Notes saved");
	};

	if (!eventId) return null;

	if (isLoading || !event) {
		return (
			<Screen
				header={
					<ScreenHeader
						title="Event"
						onBack={() => navigation.goBack()}
					/>
				}
			>
				<Loading label="Loading event" />
			</Screen>
		);
	}

	const showLabel =
		(preferences.canViewEventLabels || isAdmin) && !!eventLabel;

	return (
		<Screen
			scroll
			padded
			keyboard="aware"
			header={
				<ScreenHeader
					title={event.title}
					subtitle={moment(event.dateKey).format("ddd, MMM D")}
					onBack={() => navigation.goBack()}
					actions={
						hasEditPermission
							? [
									{
										icon: "create-outline",
										label: "Edit event",
										onPress: () =>
											navigation.navigate("EditEvent", {
												uid: eventId,
											}),
									},
								]
							: []
					}
				/>
			}
		>
			{/*
			 * Above everything else on purpose. A worker opening a shift they have
			 * not confirmed should meet the confirmation first, not find it below
			 * the notes.
			 */}
			<AcknowledgeShiftBanner
				acknowledgement={myAcknowledgement}
				onAcknowledge={acknowledge}
			/>

			{showLabel && (
				<View style={styles.labelRow}>
					{/* The company chose this color, so it is used as given. */}
					<View
						style={[
							styles.labelChip,
							{ backgroundColor: eventLabel.color },
						]}
					>
						<Text
							variant="caption"
							color={theme.colors.textInverse}
						>
							{eventLabel.name}
						</Text>
					</View>
				</View>
			)}

			{/* When & where */}
			<Card style={styles.card}>
				<View style={styles.factRow}>
					<Icon
						name="calendar-outline"
						size="md"
						color="accent"
						style={styles.factIcon}
					/>
					<View style={styles.factBody}>
						<Text variant="bodyStrong">
							{moment(event.dateKey).format("dddd, MMMM D, YYYY")}
						</Text>
					</View>
				</View>

				{event.startAt && (
					<View style={[styles.factRow, styles.factRowSpaced]}>
						<Icon
							name="time-outline"
							size="md"
							color="accent"
							style={styles.factIcon}
						/>
						<View style={styles.factBody}>
							<Text variant="bodyStrong">
								{moment(event.startAt).format("h:mm A")}
								{event.endAt
									? ` – ${moment(event.endAt).format("h:mm A")}`
									: ""}
							</Text>
							{!!event.durationSeconds && (
								<Text variant="caption" color="textSecondary">
									{(event.durationSeconds / 3600).toFixed(1)}{" "}
									hours
								</Text>
							)}
						</View>
					</View>
				)}
			</Card>

			{/* Who & what the manager said */}
			{(event.assignedUserIds?.length > 0 || event.adminNotes) && (
				<Card style={styles.card}>
					{event.assignedUserIds?.length > 0 && (
						<View style={styles.factRow}>
							<Icon
								name="people-outline"
								size="md"
								color="accent"
								style={styles.factIcon}
							/>
							<View style={styles.factBody}>
								<Text variant="label" color="textSecondary">
									Assigned
								</Text>
								<Text variant="body" style={styles.factText}>
									{workerList}
								</Text>
							</View>
						</View>
					)}

					{event.adminNotes && (
						<View
							style={[
								styles.factRow,
								event.assignedUserIds?.length > 0 &&
									styles.factRowDivided,
							]}
						>
							<Icon
								name="document-text-outline"
								size="md"
								color="accent"
								style={styles.factIcon}
							/>
							<View style={styles.factBody}>
								<Text variant="label" color="textSecondary">
									Event notes
								</Text>
								<Text variant="body" style={styles.factText}>
									{event.adminNotes}
								</Text>
							</View>
						</View>
					)}
				</Card>
			)}

			{/* Packages */}
			{packages.length > 0 && (
				<Card
					title="Packages"
					titleAccessory={
						totalChecklists > 0 ? (
							<Badge
								label={`${totalChecklists} checklists`}
								tone="accent"
							/>
						) : undefined
					}
					style={styles.card}
				>
					{packages.map((pkg, index) => (
						<View
							key={pkg.id}
							style={[
								styles.package,
								index < packages.length - 1 &&
									styles.packageDivided,
							]}
						>
							<View style={styles.packageHeader}>
								<Text variant="bodyStrong" style={styles.flex}>
									{pkg.title}
								</Text>

								{/*
								 * Descriptions are opt-in — some companies write
								 * a paragraph per package, and printing four of
								 * them buried the checklists underneath.
								 */}
								{!!pkg.description && (
									<IconButton
										name={
											shownDescriptions.includes(pkg.id)
												? "information-circle"
												: "information-circle-outline"
										}
										label={
											shownDescriptions.includes(pkg.id)
												? `Hide what ${pkg.title} includes`
												: `What ${pkg.title} includes`
										}
										size="sm"
										color={
											shownDescriptions.includes(pkg.id)
												? "accent"
												: "textTertiary"
										}
										onPress={() =>
											toggleDescription(pkg.id)
										}
									/>
								)}

								{!!pkg.checklists?.length && (
									<Button
										title={String(pkg.checklists.length)}
										icon="list-outline"
										variant="secondary"
										size="small"
										onPress={() =>
											navigation.navigate(
												"EventChecklists",
												{
													checklistIds:
														pkg.checklists.map(
															(checklist) =>
																typeof checklist ===
																"string"
																	? checklist
																	: checklist.id,
														),
													eventId,
												},
											)
										}
									/>
								)}
							</View>

							{!!pkg.description &&
								shownDescriptions.includes(pkg.id) && (
									<Text
										variant="caption"
										color="textSecondary"
										style={styles.packageDescription}
									>
										{pkg.description}
									</Text>
								)}

							{/* A preview, not the list — the button opens it. */}
							{!!pkg.checklists?.length && (
								<View style={styles.checklistPreview}>
									{pkg.checklists
										.slice(0, 2)
										.map((checklist) => (
											<View
												key={
													typeof checklist ===
													"string"
														? checklist
														: checklist.id
												}
												style={styles.checklistItem}
											>
												<Icon
													name="checkbox-outline"
													size="xs"
													color="success"
												/>
												<Text
													variant="caption"
													color="textSecondary"
													numberOfLines={1}
													style={styles.flex}
												>
													{checklist.title ||
														"Checklist"}
												</Text>
											</View>
										))}
									{pkg.checklists.length > 2 && (
										<Text
											variant="caption"
											color="textTertiary"
										>
											+{pkg.checklists.length - 2} more
										</Text>
									)}
								</View>
							)}
						</View>
					))}
				</Card>
			)}

			{/* Location */}
			{markers.length > 0 && initialRegion && (
				<Card title="Location" flush style={styles.card}>
					<MapView
						style={styles.map}
						region={initialRegion}
						scrollEnabled
					>
						{markers.map((marker, index) => (
							<Marker
								key={index}
								coordinate={{
									latitude: marker.latitude,
									longitude: marker.longitude,
								}}
								description={marker.label ? marker.title : ""}
								title={
									marker.label ? marker.label : marker.title
								}
								onCalloutPress={() =>
									openMap(marker, prefMap, marker.title)
								}
							/>
						))}
					</MapView>

					<View style={styles.mapFooter}>
						<Button
							title="Open in maps"
							icon="navigate-outline"
							variant="secondary"
							size="small"
							onPress={() =>
								openMap(markers[0], prefMap, markers[0].title)
							}
						/>
					</View>
				</Card>
			)}

			{/* Attachments */}
			{attachments && attachments.length > 0 && (
				<Card
					title="Attachments"
					titleAccessory={
						<Badge label={String(attachments.length)} />
					}
					style={styles.card}
				>
					<AttachmentGallery attachments={attachments} />
				</Card>
			)}

			{/* Personal notes — only this user sees them. */}
			<Card
				title="Your notes"
				titleAccessory={
					<IconButton
						name={isEditingNotes ? "checkmark" : "create-outline"}
						onPress={
							isEditingNotes
								? finishEditingNotes
								: () => setIsEditingNotes(true)
						}
						label={isEditingNotes ? "Save notes" : "Edit notes"}
						size="sm"
						color={isEditingNotes ? "accent" : "textSecondary"}
						haptic={isEditingNotes ? "success" : "tap"}
					/>
				}
				style={styles.card}
			>
				{isEditingNotes ? (
					<Input
						multiline
						autoFocus
						value={localNotes}
						onChangeText={setLocalNotes}
						onBlur={finishEditingNotes}
						placeholder="Anything you want to remember about this event…"
					/>
				) : (
					<Text
						variant="body"
						color={localNotes ? "text" : "textTertiary"}
					>
						{localNotes ||
							"No notes yet. Tap the pencil to add some."}
					</Text>
				)}
			</Card>

			{allChecklistIds.length > 0 && (
				<FABStack>
					<FAB
						icon="checkbox-outline"
						onPress={() =>
							navigation.navigate("EventChecklists", {
								checklistIds: allChecklistIds,
								eventId,
							})
						}
						label="Checklists"
						extended
					/>
				</FABStack>
			)}
		</Screen>
	);
};

export default EventDetails;

const detailStyles = (theme: Theme) =>
	StyleSheet.create({
		flex: {
			flex: 1,
		},
		card: {
			marginTop: theme.spacing.lg,
		},
		labelRow: {
			flexDirection: "row",
			marginTop: theme.spacing.lg,
		},
		labelChip: {
			paddingHorizontal: theme.spacing.md,
			paddingVertical: theme.spacing.xs + 2,
			borderRadius: theme.radius.pill,
		},
		factRow: {
			flexDirection: "row",
			alignItems: "flex-start",
		},
		factRowSpaced: {
			marginTop: theme.spacing.md,
		},
		factRowDivided: {
			marginTop: theme.spacing.lg,
			paddingTop: theme.spacing.lg,
			borderTopWidth: theme.hairlineWidth,
			borderTopColor: theme.colors.border,
		},
		factIcon: {
			marginRight: theme.spacing.md,
			marginTop: 1,
		},
		factBody: {
			flex: 1,
		},
		factText: {
			marginTop: 2,
		},
		package: {
			paddingBottom: theme.spacing.md,
		},
		packageDivided: {
			marginBottom: theme.spacing.md,
			borderBottomWidth: theme.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		packageHeader: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.md,
		},
		packageDescription: {
			marginTop: theme.spacing.xs,
		},
		checklistPreview: {
			marginTop: theme.spacing.sm,
			gap: theme.spacing.xs,
		},
		checklistItem: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.sm,
		},
		map: {
			height: 200,
			width: "100%",
		},
		mapFooter: {
			flexDirection: "row",
			justifyContent: "flex-end",
			padding: theme.spacing.md,
		},
	});
