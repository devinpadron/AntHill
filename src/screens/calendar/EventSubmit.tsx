import "react-native-get-random-values";
import React, {
	useRef,
	useEffect,
	useState,
	useMemo,
	useCallback,
} from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import DatePicker from "react-native-date-picker";
import moment from "moment";
import { useEventForm } from "../../hooks/useEventForm";
import { useCompanyMembers } from "../../hooks/useCompanyMembers";
import { subscribeEventResponses } from "../../services/eventService";
import {
	subscribeEventLabels,
	subscribePackages,
} from "../../services/libraryService";
import { getAttachmentsForParent } from "../../services/attachmentService";
import { LocationInput } from "../../components/eventSubmit/LocationInput";
import { useUser } from "../../contexts/UserContext";
import AttachmentsSelector from "../../components/ui/AttachmentsSelector";
import type { SelectableAttachment } from "../../components/ui/AttachmentsSelector";
import {
	Badge,
	BadgeTone,
	Button,
	Card,
	Checkbox,
	Icon,
	IconButton,
	Input,
	ListRow,
	Loading,
	Pressable,
	Screen,
	ScreenFooter,
	ScreenHeader,
	Text,
	toast,
} from "../../components/ui";
import { useUploadManager } from "../../contexts/UploadManagerContext";
import { useCompany } from "../../contexts/CompanyContext";
import { useGroups } from "../../hooks/useGroups";
import { Theme, useTheme, useThemedStyles } from "../../theme";

/*
 * Create or edit an event. The largest form in the app.
 *
 * Two `react-native-dropdown-picker` multi-selects are gone — one for assigned
 * workers, one for packages. They forced a `zIndex` ladder across the whole
 * form (3000 for workers, 2000 for packages, 1 for everything below), capped
 * selection at 5 workers, and rendered their own white dropdown regardless of
 * theme. Both are inline searchable lists now, which is also what the audience
 * picker below them already did.
 *
 * The submit bar is sticky rather than sitting at the bottom of a long scroll,
 * so saving never requires scrolling past six sections to find the button.
 */

const RESPONSE_TONE: Record<string, BadgeTone> = {
	confirmed: "success",
	pending: "warning",
	declined: "danger",
};

/** How many rows a people list shows before asking you to search. */
const PERSON_ROW_CAP = 12;

const EventSubmit = ({ navigation }) => {
	const theme = useTheme();
	const styles = useThemedStyles(submitStyles);
	const route = useRoute<any>();
	const eventId = route.params?.uid;
	const googlePlacesRef = useRef(null);

	const {
		title,
		setTitle,
		date,
		setDate,
		allDay,
		startTime,
		setStartTime,
		hasEndTime,
		endTime,
		setEndTime,
		locations,
		assignedWorkers,
		setAssignedWorkers,
		notes,
		setNotes,

		openDate,
		openStartTime,
		openEndTime,
		isLoading,
		isEditing,
		editingLabelForAddress,
		setEditingLabelForAddress,
		labelText,
		setLabelText,

		updateLocation,
		deleteLocation,
		setLocationLabel,
		toggleDatePicker,
		toggleAllDay,
		toggleEndTime,
		handleSubmitData,
		handleDelete,
		hasFormChanged,
		audienceGroupIds,
		setAudienceGroupIds,
		audienceUserIds,
		setAudienceUserIds,
	} = useEventForm(navigation, eventId);

	const { userId, companyId: currentCompany } = useUser();
	const { uploadFiles, deleteAttachments, isUploading, uploadProgress } =
		useUploadManager();
	const [attachments, setAttachments] = useState<SelectableAttachment[]>([]);
	const [attachmentDeletionQueue, setAttachmentDeletionQueue] = useState<
		string[]
	>([]);
	const [availablePackages, setAvailablePackages] = useState([]);
	const [selectedPackages, setSelectedPackages] = useState([]);
	const [loadingPackages, setLoadingPackages] = useState(false);

	const [availableLabels, setAvailableLabels] = useState([]);
	const [selectedLabelId, setSelectedLabelId] = useState(null);
	const [loadingLabels, setLoadingLabels] = useState(false);

	const [titleError, setTitleError] = useState<string>();
	const [workerSearch, setWorkerSearch] = useState("");
	const [personSearch, setPersonSearch] = useState("");

	const { preferences } = useCompany();
	const { groups } = useGroups(currentCompany ?? "");

	const isMounted = useRef(true);
	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, []);

	/*
	 * Workers.
	 *
	 * v1 subscribed to the member list and then fanned out a getUser() per
	 * member INSIDE the snapshot callback, so every membership change re-read
	 * every profile. Names live on the membership document now, and responses
	 * come from their own subscription.
	 */
	const { members } = useCompanyMembers(currentCompany ?? "");

	const [workerResponses, setWorkerResponses] = useState<
		Record<string, string>
	>({});

	useEffect(() => {
		if (!currentCompany || !eventId) return;
		return subscribeEventResponses(
			currentCompany,
			eventId,
			setWorkerResponses,
		);
	}, [currentCompany, eventId]);

	/* Responses only exist for a saved event, and only when the flag is on. */
	const showResponses = Boolean(eventId && preferences.enableAvailability);

	/*
	 * Assigned workers, ordered so the ones needing attention surface first:
	 * confirmed, then pending, then declined, alphabetical within each.
	 */
	const orderedMembers = useMemo(() => {
		const priority = { confirmed: 0, pending: 1, declined: 2 };

		return [...members].sort((a, b) => {
			if (showResponses) {
				const statusA = workerResponses[a.userId] ?? "pending";
				const statusB = workerResponses[b.userId] ?? "pending";
				const diff = priority[statusA] - priority[statusB];
				if (diff !== 0) return diff;
			}
			return a.displayName.localeCompare(b.displayName);
		});
	}, [members, workerResponses, showResponses]);

	const selectedWorkers = useMemo(
		() => orderedMembers.filter((m) => assignedWorkers.includes(m.userId)),
		[orderedMembers, assignedWorkers],
	);

	const unselectedWorkers = useMemo(() => {
		const term = workerSearch.trim().toLowerCase();
		return orderedMembers.filter(
			(m) =>
				!assignedWorkers.includes(m.userId) &&
				(!term || m.displayName.toLowerCase().includes(term)),
		);
	}, [orderedMembers, assignedWorkers, workerSearch]);

	const toggleWorker = useCallback(
		(id: string) =>
			setAssignedWorkers((prev) =>
				prev.includes(id)
					? prev.filter((v) => v !== id)
					: [...prev, id],
			),
		[setAssignedWorkers],
	);

	/*
	 * The audience picker.
	 *
	 * Selected people are pinned above the search box so that typing a name
	 * cannot hide someone already chosen — otherwise a manager filtering for
	 * one person appears to have lost the rest.
	 */
	const isTargetedAudience =
		audienceGroupIds.length > 0 || audienceUserIds.length > 0;

	const toggleAudienceUser = useCallback(
		(id: string) =>
			setAudienceUserIds((prev) =>
				prev.includes(id)
					? prev.filter((v) => v !== id)
					: [...prev, id],
			),
		[setAudienceUserIds],
	);

	const selectedAudienceMembers = useMemo(
		() => members.filter((m) => audienceUserIds.includes(m.userId)),
		[members, audienceUserIds],
	);

	const matchingUnselected = useMemo(() => {
		const term = personSearch.trim().toLowerCase();
		return members.filter(
			(m) =>
				!audienceUserIds.includes(m.userId) &&
				(!term || m.displayName.toLowerCase().includes(term)),
		);
	}, [members, audienceUserIds, personSearch]);

	const unselectedAudienceMembers = matchingUnselected.slice(
		0,
		PERSON_ROW_CAP,
	);
	const hiddenPersonCount = Math.max(
		0,
		matchingUnselected.length - PERSON_ROW_CAP,
	);

	// Packages: one live query for the catalogue.
	useEffect(() => {
		if (!currentCompany) return;
		setLoadingPackages(true);
		return subscribePackages(currentCompany, (next) => {
			setAvailablePackages(next);
			setLoadingPackages(false);
		});
	}, [currentCompany]);

	useEffect(() => {
		if (!currentCompany) return;

		// Labels come from a subscription; the event's own label arrives with the
		// event itself rather than a second read of the same document.
		setLoadingLabels(true);
		return subscribeEventLabels(currentCompany, (next) => {
			setAvailableLabels(next);
			setLoadingLabels(false);
		});
	}, [currentCompany, eventId]);

	// Load attachments if editing an event
	useEffect(() => {
		if (!eventId) return;

		const fetchAttachments = async () => {
			const existing = await getAttachmentsForParent(
				currentCompany,
				"event",
				eventId,
			);

			setAttachments(
				existing.map((a) => ({
					id: a.id,
					kind: "persisted" as const,
					fileName: a.fileName,
					contentType: a.contentType,
					sizeBytes: a.sizeBytes,
					displayUri: a.downloadUrl,
					thumbnailUri: a.thumbnailDownloadUrl,
				})),
			);
		};

		fetchAttachments();
	}, [eventId, currentCompany]);

	const handleBackPress = () => {
		if (!hasFormChanged()) {
			navigation.goBack();
			return;
		}

		Alert.alert(
			"Discard changes?",
			"You have unsaved changes to this event.",
			[
				{ text: "Keep editing", style: "cancel" },
				{
					text: "Discard",
					style: "destructive",
					onPress: () => navigation.goBack(),
				},
			],
		);
	};

	const handleAttachmentSubmit = async (savedId: string) => {
		try {
			if (!isMounted.current) return;

			if (!savedId || !currentCompany) {
				toast.error(
					"Could not save attachments",
					"The event was saved, but its files were not.",
				);
				return;
			}

			/*
			 * Only drafts get uploaded. v1 filtered on a URI prefix to guess
			 * which files were new; `kind` states it outright.
			 */
			const drafts = attachments.filter((att) => att.kind === "draft");

			// First delete any files in the deletion queue
			if (attachmentDeletionQueue.length > 0) {
				await deleteAttachments(
					currentCompany,
					"event",
					savedId,
					attachmentDeletionQueue.map((a: any) =>
						typeof a === "string" ? a : a.id,
					),
				);
			}

			// Then upload any new files
			if (drafts.length > 0) {
				await uploadFiles(
					currentCompany,
					"event",
					savedId,
					drafts.map((d) => ({
						id: d.id,
						uri: d.displayUri,
						name: d.fileName,
						type: d.contentType,
						size: d.sizeBytes,
						width: d.width,
						height: d.height,
						thumbnailUri: d.thumbnailUri,
					})),
					userId,
				);

				// uploadFiles returns ids; the live attachment subscription on
				// the details screen is what renders them, so there is nothing
				// to merge into local state here.
			}

			setAttachmentDeletionQueue([]);

			// Only navigate after all operations are complete
			if (isMounted.current) {
				toast.success(isEditing ? "Event updated" : "Event created");
				navigation.pop();
			}
		} catch (error) {
			console.error("Error handling attachments:", error);
			toast.error(
				"Could not upload attachments",
				"The event saved, but please try the files again.",
			);
		}
	};

	const handleSubmit = async () => {
		if (!title.trim()) {
			setTitleError("Give the event a title.");
			toast.warning("The event needs a title");
			return;
		}

		setTitleError(undefined);

		/*
		 * Packages and the label go in with everything else. v1 called
		 * handleSubmitData and then issued a SECOND updateEvent for these two
		 * fields — so creating an event was three writes and a reader could
		 * observe it without its packages.
		 */
		const savedId = await handleSubmitData({
			packageIds: selectedPackages,
			labelId: selectedLabelId,
			audienceGroupIds,
			audienceUserIds,
		});

		if (savedId) await handleAttachmentSubmit(savedId);
	};

	const togglePackage = (packageId: string) =>
		setSelectedPackages((prev) =>
			prev.includes(packageId)
				? prev.filter((id) => id !== packageId)
				: [...prev, packageId],
		);

	/*
	 * Package descriptions are opt-in.
	 *
	 * They used to print in full under every checkbox. Some companies write a
	 * paragraph, so choosing between four packages meant scrolling past four
	 * paragraphs — the list of things to pick got buried in the explanation of
	 * what they are. The info button is per package, so you read the one you are
	 * unsure about.
	 */
	const [shownDescriptions, setShownDescriptions] = useState<string[]>([]);

	const toggleDescription = (packageId: string) =>
		setShownDescriptions((prev) =>
			prev.includes(packageId)
				? prev.filter((id) => id !== packageId)
				: [...prev, packageId],
		);

	const pickerTheme = theme.isDark ? "dark" : "light";

	return (
		<Screen
			scroll
			padded
			keyboard="aware"
			header={
				<ScreenHeader
					title={isEditing ? "Edit event" : "New event"}
					onBack={handleBackPress}
					actions={
						isEditing
							? [
									{
										icon: "trash-outline",
										label: "Delete event",
										color: "danger",
										onPress: handleDelete,
									},
								]
							: []
					}
				/>
			}
			footer={
				<ScreenFooter safeArea>
					<Button
						title={isEditing ? "Save changes" : "Create event"}
						icon="checkmark"
						onPress={handleSubmit}
						fullWidth
						size="large"
						haptic="press"
						loading={isLoading || isUploading}
						disabled={isUploading || isLoading}
					/>
				</ScreenFooter>
			}
		>
			{/* What and where */}
			<Card title="Event details" style={styles.card}>
				<Input
					label="Title"
					placeholder="Rehearsal dinner, Smith wedding…"
					value={title}
					onChangeText={(v) => {
						setTitle(v);
						if (titleError) setTitleError(undefined);
					}}
					error={titleError}
					containerStyle={styles.field}
				/>

				<LocationInput
					locations={locations}
					onLocationSelect={updateLocation}
					onLocationDelete={deleteLocation}
					onLabelChange={setLocationLabel}
					editingLabelForAddress={editingLabelForAddress}
					setEditingLabelForAddress={setEditingLabelForAddress}
					labelText={labelText}
					setLabelText={setLabelText}
					googlePlacesRef={googlePlacesRef}
				/>
			</Card>

			{/* When */}
			<Card title="Date & time" flush style={styles.card}>
				<ListRow
					title="Date"
					icon="calendar-outline"
					value={moment(date).format("ddd, MMM D, YYYY")}
					onPress={() => toggleDatePicker("date")}
					chevron={false}
				/>

				<View style={styles.rowPadded}>
					<Checkbox
						checked={allDay}
						onPress={toggleAllDay}
						label="All day"
					/>
				</View>

				{!allDay && (
					<>
						<ListRow
							title="Starts"
							icon="time-outline"
							value={moment(startTime).format("h:mm A")}
							onPress={() => toggleDatePicker("startTime")}
							chevron={false}
						/>

						<View style={styles.rowPadded}>
							<Checkbox
								checked={hasEndTime}
								onPress={toggleEndTime}
								label="Set an end time"
							/>
						</View>

						{hasEndTime && (
							<ListRow
								title="Ends"
								icon="time-outline"
								value={moment(endTime).format("MMM D, h:mm A")}
								onPress={() => toggleDatePicker("endTime")}
								chevron={false}
								separator={false}
							/>
						)}
					</>
				)}

				<DatePicker
					modal
					open={openDate}
					date={date}
					mode="date"
					theme={pickerTheme}
					onConfirm={(next) => {
						toggleDatePicker("date");
						setDate(next);
					}}
					onCancel={() => toggleDatePicker("date")}
				/>
				<DatePicker
					modal
					open={openStartTime}
					date={startTime}
					mode="time"
					theme={pickerTheme}
					onConfirm={(next) => {
						toggleDatePicker("startTime");
						setStartTime(next);
					}}
					onCancel={() => toggleDatePicker("startTime")}
				/>
				<DatePicker
					modal
					open={openEndTime}
					date={endTime}
					mode="datetime"
					theme={pickerTheme}
					onConfirm={(next) => {
						toggleDatePicker("endTime");
						setEndTime(next);
					}}
					onCancel={() => toggleDatePicker("endTime")}
				/>
			</Card>

			{/* Assigned workers */}
			<Card
				title="Assigned workers"
				titleAccessory={
					assignedWorkers.length > 0 ? (
						<Badge
							label={`${assignedWorkers.length} assigned`}
							tone="accent"
						/>
					) : undefined
				}
				style={styles.card}
			>
				{selectedWorkers.map((member) => (
					<Checkbox
						key={member.userId}
						checked
						onPress={() => toggleWorker(member.userId)}
						label={member.displayName}
						style={styles.personRow}
					/>
				))}

				{members.length > 8 && (
					<Input
						placeholder="Search workers"
						icon="search"
						value={workerSearch}
						onChangeText={setWorkerSearch}
						autoCapitalize="none"
						autoCorrect={false}
						containerStyle={styles.field}
					/>
				)}

				{unselectedWorkers.length === 0 ? (
					<Text variant="caption" color="textTertiary">
						{workerSearch.trim()
							? "Nobody matches that name."
							: "Everyone is already assigned."}
					</Text>
				) : (
					unselectedWorkers.slice(0, PERSON_ROW_CAP).map((member) => {
						const status = workerResponses[member.userId];

						return (
							<View key={member.userId} style={styles.personRow}>
								<Checkbox
									checked={false}
									onPress={() => toggleWorker(member.userId)}
									label={member.displayName}
									style={styles.flex}
								/>
								{showResponses && !!status && (
									<Badge
										label={status}
										tone={
											RESPONSE_TONE[status] ?? "neutral"
										}
										dot
									/>
								)}
							</View>
						);
					})
				)}

				{unselectedWorkers.length > PERSON_ROW_CAP && (
					<Text variant="caption" color="textTertiary">
						{unselectedWorkers.length - PERSON_ROW_CAP} more —
						search to narrow the list.
					</Text>
				)}
			</Card>

			{/* Who gets asked about this event */}
			{preferences.enableAvailability && (
				<Card
					title="Who can see this event"
					titleAccessory={
						isTargetedAudience ? (
							<Badge label="Targeted" tone="accent" />
						) : (
							<Badge label="Everyone" />
						)
					}
					style={styles.card}
				>
					<Text
						variant="caption"
						color="textSecondary"
						style={styles.hint}
					>
						{isTargetedAudience
							? "Only the people below will be asked about it."
							: "Everyone who can see open jobs. Pick a group or specific people to send it only to them."}
					</Text>

					<Text
						variant="label"
						color="textSecondary"
						uppercase
						style={styles.subheading}
					>
						Groups
					</Text>

					{groups.length === 0 ? (
						<Text variant="caption" color="textTertiary">
							No groups yet — create one under Settings › Worker
							groups.
						</Text>
					) : (
						groups.map((group) => (
							<Checkbox
								key={group.id}
								checked={audienceGroupIds.includes(group.id)}
								onPress={() =>
									setAudienceGroupIds(
										audienceGroupIds.includes(group.id)
											? audienceGroupIds.filter(
													(g) => g !== group.id,
												)
											: [...audienceGroupIds, group.id],
									)
								}
								label={group.name}
							/>
						))
					)}

					{/*
					 * Specific people, for the one-off a group cannot express.
					 * Selected names are pinned above the search so filtering
					 * never hides someone you already picked.
					 */}
					<Text
						variant="label"
						color="textSecondary"
						uppercase
						style={styles.subheading}
					>
						Specific people
					</Text>

					{selectedAudienceMembers.map((member) => (
						<Checkbox
							key={member.userId}
							checked
							onPress={() => toggleAudienceUser(member.userId)}
							label={member.displayName}
						/>
					))}

					{members.length > 8 && (
						<Input
							placeholder="Search people"
							icon="search"
							value={personSearch}
							onChangeText={setPersonSearch}
							autoCapitalize="none"
							autoCorrect={false}
							containerStyle={styles.field}
						/>
					)}

					{unselectedAudienceMembers.length === 0 ? (
						<Text variant="caption" color="textTertiary">
							{personSearch.trim()
								? "Nobody matches that name."
								: "Everyone is already selected."}
						</Text>
					) : (
						unselectedAudienceMembers.map((member) => (
							<Checkbox
								key={member.userId}
								checked={false}
								onPress={() =>
									toggleAudienceUser(member.userId)
								}
								label={member.displayName}
							/>
						))
					)}

					{hiddenPersonCount > 0 && (
						<Text variant="caption" color="textTertiary">
							{hiddenPersonCount} more — search to narrow the
							list.
						</Text>
					)}
				</Card>
			)}

			{/* Packages */}
			<Card
				title="Packages"
				titleAccessory={
					selectedPackages.length > 0 ? (
						<Badge
							label={String(selectedPackages.length)}
							tone="accent"
						/>
					) : undefined
				}
				style={styles.card}
			>
				{loadingPackages ? (
					<Loading fill={false} size="small" />
				) : availablePackages.length === 0 ? (
					<Text variant="caption" color="textTertiary">
						No packages yet — create them under Settings › Packages.
					</Text>
				) : (
					availablePackages.map((pkg) => {
						const count = pkg.checklists?.length ?? 0;
						const showing = shownDescriptions.includes(pkg.id);

						return (
							<View key={pkg.id}>
								<View style={styles.packageRow}>
									<Checkbox
										checked={selectedPackages.includes(
											pkg.id,
										)}
										onPress={() => togglePackage(pkg.id)}
										label={pkg.title}
										description={`${count} ${
											count === 1
												? "checklist"
												: "checklists"
										}`}
										style={styles.packageCheckbox}
									/>
									{!!pkg.description && (
										<IconButton
											name={
												showing
													? "information-circle"
													: "information-circle-outline"
											}
											label={
												showing
													? `Hide what ${pkg.title} includes`
													: `What ${pkg.title} includes`
											}
											size="sm"
											color={
												showing
													? "accent"
													: "textTertiary"
											}
											onPress={() =>
												toggleDescription(pkg.id)
											}
										/>
									)}
								</View>

								{showing && !!pkg.description && (
									<Text
										variant="caption"
										color="textSecondary"
										style={styles.packageDescription}
									>
										{pkg.description}
									</Text>
								)}
							</View>
						);
					})
				)}
			</Card>

			{/* Label */}
			<Card title="Label" style={styles.card}>
				{loadingLabels ? (
					<Loading fill={false} size="small" />
				) : availableLabels.length === 0 ? (
					<Text variant="caption" color="textTertiary">
						No labels yet — create them under Settings › Event
						labels.
					</Text>
				) : (
					<View style={styles.labelGrid}>
						<LabelChip
							selected={!selectedLabelId}
							onPress={() => setSelectedLabelId(null)}
							name="None"
						/>
						{availableLabels.map((label) => (
							<LabelChip
								key={label.id}
								selected={selectedLabelId === label.id}
								onPress={() => setSelectedLabelId(label.id)}
								name={label.name}
								color={label.color}
							/>
						))}
					</View>
				)}
			</Card>

			{/* Notes and files */}
			<Card title="Notes & attachments" style={styles.card}>
				<Input
					placeholder="Anything the crew should know…"
					multiline
					value={notes}
					onChangeText={setNotes}
					containerStyle={styles.field}
				/>

				<AttachmentsSelector
					showDocuments
					showMedia
					attachments={attachments}
					setAttachments={setAttachments}
					deletionQueue={attachmentDeletionQueue}
					setDeletionQueue={setAttachmentDeletionQueue}
					uploadProgress={uploadProgress}
				/>
			</Card>
		</Screen>
	);
};

/**
 * One selectable label swatch.
 *
 * The dot carries the company's chosen color as-is; the chip around it is
 * themed, so a pale label stays legible on a dark background.
 */
const LabelChip = ({
	name,
	color,
	selected,
	onPress,
}: {
	name: string;
	color?: string;
	selected: boolean;
	onPress: () => void;
}) => {
	const styles = useThemedStyles(submitStyles);

	return (
		<Pressable
			onPress={onPress}
			haptic="selection"
			accessibilityRole="radio"
			accessibilityState={{ selected }}
			accessibilityLabel={name}
			style={[styles.chip, selected && styles.chipSelected]}
		>
			{color ? (
				<View style={[styles.chipDot, { backgroundColor: color }]} />
			) : (
				<Icon name="close" size="xs" color="textTertiary" />
			)}
			<Text variant="label" color={selected ? "accent" : "textSecondary"}>
				{name}
			</Text>
			{selected && <Icon name="checkmark" size="xs" color="accent" />}
		</Pressable>
	);
};

const submitStyles = (theme: Theme) =>
	StyleSheet.create({
		flex: {
			flex: 1,
		},
		card: {
			marginTop: theme.spacing.lg,
		},
		packageRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.xs,
		},
		packageCheckbox: {
			flex: 1,
		},
		packageDescription: {
			paddingLeft: theme.spacing.xl + theme.spacing.sm,
			paddingRight: theme.spacing.md,
			paddingBottom: theme.spacing.sm,
		},
		field: {
			marginBottom: theme.spacing.lg,
		},
		rowPadded: {
			paddingHorizontal: theme.spacing.lg,
			paddingVertical: theme.spacing.xs,
		},
		personRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.sm,
		},
		hint: {
			marginBottom: theme.spacing.md,
		},
		subheading: {
			marginTop: theme.spacing.lg,
			marginBottom: theme.spacing.sm,
		},
		labelGrid: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: theme.spacing.sm,
		},
		chip: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.sm,
			paddingHorizontal: theme.spacing.md,
			paddingVertical: theme.spacing.sm,
			borderRadius: theme.radius.pill,
			borderWidth: theme.hairlineWidth,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.surfaceSunken,
			minHeight: 36,
		},
		chipSelected: {
			borderColor: theme.colors.accentBorder,
			backgroundColor: theme.colors.accentSubtle,
		},
		chipDot: {
			width: 12,
			height: 12,
			borderRadius: 6,
		},
	});

export default EventSubmit;
