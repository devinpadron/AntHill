import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
	createEvent,
	deleteEvent,
	getEvent,
	getEventsInRange,
	syncEventAudience,
	updateEvent,
} from "@app/services/eventService";
import {
	subscribeEventLabels,
	subscribePackages,
} from "@app/services/libraryService";
import { useCompanyMembers } from "@app/hooks/useCompanyMembers";
import { useGroups } from "@app/hooks/useGroups";
import { showConfirmation } from "@app/utils/alertUtils";
import { FilterType } from "@app/types/enums/FilterType";
import { Role } from "@app/types/enums/Role";
import type { Event, EventLabel, Package } from "@app/types";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import { useUploads } from "../../contexts/UploadContext";
import {
	Badge,
	Button,
	Card,
	Icon,
	Input,
	LoadingPane,
	Text,
	Textarea,
	useToast,
} from "../../ui";
import { PlacesInput, type PickedPlace } from "./PlacesInput";
import styles from "./EventEditorPage.module.css";

/*
 * Create and edit an event.
 *
 * A full page, not a modal: the form is long, and a desktop has the room. Two
 * columns — the event's own facts on the left, the people questions on the
 * right, sticky, because staffing is what an admin keeps coming back to while
 * filling in the rest.
 *
 * Writes go through createEvent / updateEvent / syncEventAudience / deleteEvent,
 * the same functions EventSubmit.tsx calls, so an event created here is
 * byte-identical to one created on the phone.
 *
 * Two things the phone cannot show while you work:
 *   - who is ALREADY BOOKED that day, marked in the staffing list as you pick
 *   - how many people will actually SEE the event, computed live from the
 *     audience you have chosen
 */

type Draft = {
	title: string;
	dateKey: string;
	isAllDay: boolean;
	startTime: string;
	endTime: string;
	adminNotes: string;
	workerNotes: string;
	labelId: string | null;
	assignedUserIds: string[];
	audienceGroupIds: string[];
	audienceUserIds: string[];
	packageIds: string[];
	locations: Record<
		string,
		{ latitude: number; longitude: number; label?: string | null }
	>;
};

const todayKey = () => {
	const now = new Date();
	return [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, "0"),
		String(now.getDate()).padStart(2, "0"),
	].join("-");
};

const EMPTY: Draft = {
	title: "",
	dateKey: todayKey(),
	isAllDay: false,
	startTime: "09:00",
	endTime: "17:00",
	adminNotes: "",
	workerNotes: "",
	labelId: null,
	assignedUserIds: [],
	audienceGroupIds: [],
	audienceUserIds: [],
	packageIds: [],
	locations: {},
};

export function EventEditorPage() {
	const { companyId, eventId } = useParams<{
		companyId: string;
		eventId?: string;
	}>();
	const isNew = !eventId;
	const navigate = useNavigate();
	const toast = useToast();
	const { userId } = useAuth();
	const { preferences } = useCompany();
	const { members } = useCompanyMembers(companyId!);
	const { groups } = useGroups(companyId!);
	const { uploadFiles, uploadProgress, isUploading } = useUploads();

	const [draft, setDraft] = useState<Draft>(EMPTY);
	const [labels, setLabels] = useState<EventLabel[]>([]);
	const [packages, setPackages] = useState<Package[]>([]);
	const [sameDay, setSameDay] = useState<Event[]>([]);
	const [loading, setLoading] = useState(!isNew);
	const [saving, setSaving] = useState(false);
	const [workerQuery, setWorkerQuery] = useState("");
	const [askQuery, setAskQuery] = useState("");
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);

	const set = (patch: Partial<Draft>) =>
		setDraft((current) => ({ ...current, ...patch }));

	useEffect(() => subscribeEventLabels(companyId!, setLabels), [companyId]);
	useEffect(() => subscribePackages(companyId!, setPackages), [companyId]);

	/* ---- load an existing event ---- */
	useEffect(() => {
		if (!eventId) return;
		let live = true;
		getEvent(eventId)
			.then((event) => {
				if (!live || !event) return;
				const start = event.startAt?.toDate?.();
				const end = event.endAt?.toDate?.();
				setDraft({
					title: event.title ?? "",
					dateKey: event.dateKey,
					isAllDay: Boolean(event.isAllDay),
					startTime: start ? clockOf(start) : "09:00",
					endTime: end ? clockOf(end) : "17:00",
					adminNotes: event.adminNotes ?? "",
					workerNotes: event.workerNotes ?? "",
					labelId: event.labelId ?? null,
					assignedUserIds: event.assignedUserIds ?? [],
					audienceGroupIds: event.audienceGroupIds ?? [],
					audienceUserIds: event.audienceUserIds ?? [],
					packageIds: event.packageIds ?? [],
					locations: event.locations ?? {},
				});
			})
			.finally(() => live && setLoading(false));
		return () => {
			live = false;
		};
	}, [eventId]);

	/* ---- who is already booked that day ---- */
	useEffect(() => {
		if (!draft.dateKey) return;
		let live = true;
		getEventsInRange(companyId!, {
			from: draft.dateKey,
			to: draft.dateKey,
			filter: FilterType.ALL,
		})
			.then(
				(found) =>
					live && setSameDay(found.filter((e) => e.id !== eventId)),
			)
			.catch(() => live && setSameDay([]));
		return () => {
			live = false;
		};
	}, [companyId, draft.dateKey, eventId]);

	const bookedElsewhere = useMemo(() => {
		const map = new Map<string, string[]>();
		for (const event of sameDay) {
			for (const assigned of event.assignedUserIds ?? []) {
				map.set(assigned, [...(map.get(assigned) ?? []), event.title]);
			}
		}
		return map;
	}, [sameDay]);

	/* ---- how many people will actually see this ---- */
	const audienceReach = useMemo(() => {
		if (!draft.audienceGroupIds.length && !draft.audienceUserIds.length) {
			return null; // untargeted — everyone
		}
		const reached = new Set(draft.audienceUserIds);
		for (const member of members) {
			if (
				(member.groupIds ?? []).some((id) =>
					draft.audienceGroupIds.includes(id),
				)
			) {
				reached.add(member.userId);
			}
		}
		return reached.size;
	}, [draft.audienceGroupIds, draft.audienceUserIds, members]);

	const workers = useMemo(() => {
		const needle = workerQuery.trim().toLowerCase();
		const list = members.filter((m) => m.status === "active");
		if (!needle) return list;
		return list.filter((m) =>
			`${m.firstName} ${m.lastName}`.toLowerCase().includes(needle),
		);
	}, [members, workerQuery]);

	/*
	 * Who can be ASKED. Managers and owners see every job already, so inviting
	 * them is a no-op — offering it would just be a checkbox that does nothing.
	 */
	const askable = useMemo(() => {
		const needle = askQuery.trim().toLowerCase();
		const list = members.filter(
			(m) => m.status === "active" && m.role === Role.USER,
		);
		if (!needle) return list;
		return list.filter((m) =>
			`${m.firstName} ${m.lastName}`.toLowerCase().includes(needle),
		);
	}, [members, askQuery]);

	/**
	 * Assigned without ever having confirmed they were free.
	 *
	 * Not an error — a manager may know perfectly well that someone is
	 * available. But assigning over an unanswered invitation is worth seeing,
	 * because the reply can no longer arrive: the event leaves the Availability
	 * tab the moment anyone is assigned.
	 */
	const assignedWithoutReply = useMemo(() => {
		const invited = new Set(draft.audienceUserIds);
		for (const member of members) {
			if (
				(member.groupIds ?? []).some((id) =>
					draft.audienceGroupIds.includes(id),
				)
			) {
				invited.add(member.userId);
			}
		}
		if (!invited.size) return [];
		return draft.assignedUserIds.filter((id) => invited.has(id));
	}, [
		draft.assignedUserIds,
		draft.audienceUserIds,
		draft.audienceGroupIds,
		members,
	]);

	const timesInvalid =
		!draft.isAllDay &&
		draft.endTime !== "" &&
		draft.endTime <= draft.startTime;

	const canSave = draft.title.trim().length > 0 && !timesInvalid && !saving;

	async function save() {
		if (!canSave) return;
		setSaving(true);
		try {
			const startAt = draft.isAllDay
				? null
				: combine(draft.dateKey, draft.startTime);
			const endAt = draft.isAllDay
				? null
				: combine(draft.dateKey, draft.endTime);

			const input = {
				title: draft.title.trim(),
				dateKey: draft.dateKey,
				isAllDay: draft.isAllDay,
				startAt,
				endAt,
				adminNotes: draft.adminNotes,
				workerNotes: draft.workerNotes,
				labelId: draft.labelId,
				assignedUserIds: draft.assignedUserIds,
				packageIds: draft.packageIds,
				audienceGroupIds: draft.audienceGroupIds,
				audienceUserIds: draft.audienceUserIds,
				locations: draft.locations,
			};

			const id = eventId
				? (await updateEvent(eventId, input, userId), eventId)
				: await createEvent(companyId!, input, userId);

			// Audience fan-out is a separate write in the service — it creates
			// the eventResponses documents the invitations are built from.
			await syncEventAudience(
				companyId!,
				id,
				draft.dateKey,
				draft.audienceGroupIds,
				draft.audienceUserIds,
			);

			if (pendingFiles.length) {
				await uploadFiles(
					companyId!,
					"event",
					id,
					pendingFiles,
					userId,
				);
			}

			toast.success(isNew ? "Event created" : "Event saved");
			navigate(`/${companyId}/calendar/events/${id}`);
		} catch (error) {
			toast.error(
				"Could not save the event",
				error instanceof Error ? error.message : undefined,
			);
		} finally {
			setSaving(false);
		}
	}

	function remove() {
		if (!eventId) return;
		showConfirmation(
			`Delete "${draft.title}"?`,
			"This also removes every invitation, checklist state and file attached to it. It cannot be undone.",
			() => {
				void (async () => {
					try {
						await deleteEvent(companyId!, eventId);
						toast.success("Event deleted");
						navigate(`/${companyId}/calendar`);
					} catch (error) {
						toast.error(
							"Could not delete the event",
							error instanceof Error ? error.message : undefined,
						);
					}
				})();
			},
			"Delete",
			"destructive",
		);
	}

	function addLocation(place: PickedPlace) {
		set({
			locations: {
				...draft.locations,
				[place.address]: {
					latitude: place.latitude ?? 0,
					longitude: place.longitude ?? 0,
					label: null,
				},
			},
		});
	}

	if (loading) return <LoadingPane label="Loading event" />;

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div>
					<Text variant="display" as="h1">
						{isNew ? "New event" : "Edit event"}
					</Text>
					{!isNew && (
						<Text variant="caption" tone="tertiary" mono>
							{eventId}
						</Text>
					)}
				</div>
				<div className={styles.headerActions}>
					{!isNew && (
						<Button
							variant="ghost"
							icon="trash-outline"
							onClick={remove}
						>
							Delete
						</Button>
					)}
					<Button
						variant="ghost"
						onClick={() => navigate(`/${companyId}/calendar`)}
					>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={save}
						busy={saving || isUploading}
						disabled={!canSave}
					>
						{isNew ? "Create event" : "Save changes"}
					</Button>
				</div>
			</header>

			<div className={styles.columns}>
				{/* ------------------------------------------------- left */}
				<div className={styles.left}>
					<Card title="Basics">
						<div className={styles.stack}>
							<Input
								label="Title"
								value={draft.title}
								onChange={(e) => set({ title: e.target.value })}
								placeholder="Wexler wedding"
								required
								autoFocus
							/>

							<div className={styles.row}>
								<Input
									label="Date"
									type="date"
									value={draft.dateKey}
									onChange={(e) =>
										set({ dateKey: e.target.value })
									}
								/>
								<label className={styles.allDay}>
									<input
										type="checkbox"
										checked={draft.isAllDay}
										onChange={(e) =>
											set({ isAllDay: e.target.checked })
										}
									/>
									<Text variant="body" as="span">
										All day
									</Text>
								</label>
							</div>

							{!draft.isAllDay && (
								<div className={styles.row}>
									<Input
										label="Starts"
										type="time"
										value={draft.startTime}
										onChange={(e) =>
											set({ startTime: e.target.value })
										}
									/>
									<Input
										label="Ends"
										type="time"
										value={draft.endTime}
										onChange={(e) =>
											set({ endTime: e.target.value })
										}
										error={
											timesInvalid
												? "End must be after start"
												: undefined
										}
									/>
									{!timesInvalid && (
										<div className={styles.duration}>
											<Text
												variant="caption"
												tone="tertiary"
											>
												Duration
											</Text>
											<Text variant="bodyStrong">
												{durationLabel(
													draft.startTime,
													draft.endTime,
												)}
											</Text>
										</div>
									)}
								</div>
							)}

							{labels.length > 0 && (
								<div className={styles.field}>
									<Text variant="label" tone="secondary">
										Label
									</Text>
									<div className={styles.labelPicker}>
										<button
											type="button"
											className={[
												styles.labelSwatch,
												draft.labelId === null
													? styles.labelSwatchActive
													: "",
											]
												.filter(Boolean)
												.join(" ")}
											onClick={() =>
												set({ labelId: null })
											}
										>
											<Text variant="caption" as="span">
												None
											</Text>
										</button>
										{labels.map((label) => (
											<button
												key={label.id}
												type="button"
												className={[
													styles.labelSwatch,
													draft.labelId === label.id
														? styles.labelSwatchActive
														: "",
												]
													.filter(Boolean)
													.join(" ")}
												onClick={() =>
													set({ labelId: label.id })
												}
											>
												<span
													className={styles.dot}
													style={{
														background: label.color,
													}}
												/>
												<Text
													variant="caption"
													as="span"
												>
													{label.name}
												</Text>
											</button>
										))}
									</div>
								</div>
							)}
						</div>
					</Card>

					<Card title="Where">
						<div className={styles.stack}>
							<PlacesInput onPick={addLocation} />

							{Object.entries(draft.locations).map(
								([address, location]) => (
									<div
										key={address}
										className={styles.locationRow}
									>
										<Icon
											name="location-outline"
											size="sm"
											className={styles.dim}
										/>
										<div className={styles.locationBody}>
											<Text variant="body" clamp={1}>
												{address}
											</Text>
											<Input
												placeholder="Friendly name (optional) — e.g. Loading dock"
												value={location.label ?? ""}
												onChange={(e) =>
													set({
														locations: {
															...draft.locations,
															[address]: {
																...location,
																label:
																	e.target
																		.value ||
																	null,
															},
														},
													})
												}
											/>
											{location.latitude === 0 &&
												location.longitude === 0 && (
													<Text
														variant="caption"
														tone="tertiary"
													>
														No coordinates — typed
														manually
													</Text>
												)}
										</div>
										<button
											type="button"
											className={styles.removeButton}
											aria-label={`Remove ${address}`}
											onClick={() => {
												const next = {
													...draft.locations,
												};
												delete next[address];
												set({ locations: next });
											}}
										>
											<Icon name="close" size="sm" />
										</button>
									</div>
								),
							)}
						</div>
					</Card>

					<Card title="Notes">
						<div className={styles.stack}>
							<Textarea
								label="Admin notes"
								hint="Only managers and owners see these."
								value={draft.adminNotes}
								onChange={(e) =>
									set({ adminNotes: e.target.value })
								}
								rows={4}
							/>
							<Textarea
								label="Worker notes"
								hint={
									preferences.allowUserEventEditing
										? "Visible to assigned workers, who can also edit them."
										: "Visible to assigned workers."
								}
								value={draft.workerNotes}
								onChange={(e) =>
									set({ workerNotes: e.target.value })
								}
								rows={4}
							/>
						</div>
					</Card>

					<Card title="Files">
						<div className={styles.stack}>
							<label className={styles.dropzone}>
								<input
									type="file"
									multiple
									onChange={(e) =>
										setPendingFiles((current) => [
											...current,
											...Array.from(e.target.files ?? []),
										])
									}
								/>
								<Icon name="cloud-upload-outline" size="lg" />
								<Text variant="body" tone="secondary">
									Choose files to attach
								</Text>
								<Text variant="caption" tone="tertiary">
									They upload when you save.
								</Text>
							</label>

							{pendingFiles.map((file, index) => {
								const progress = Object.values(
									uploadProgress,
								).find((p) => p.fileName === file.name);
								return (
									<div
										key={`${file.name}-${index}`}
										className={styles.pendingFile}
									>
										<Icon
											name="document-outline"
											size="sm"
											className={styles.dim}
										/>
										<Text variant="caption" clamp={1}>
											{file.name}
										</Text>
										<Text
											variant="caption"
											tone="tertiary"
											as="span"
										>
											{(file.size / 1024).toFixed(0)} KB
										</Text>
										{progress ? (
											<Badge
												tone={
													progress.status === "error"
														? "danger"
														: progress.status ===
															  "complete"
															? "success"
															: "accent"
												}
											>
												{progress.status === "uploading"
													? `${Math.round(
															progress.progress *
																100,
														)}%`
													: progress.status}
											</Badge>
										) : (
											<button
												type="button"
												className={styles.removeButton}
												aria-label="Remove"
												onClick={() =>
													setPendingFiles((current) =>
														current.filter(
															(_, i) =>
																i !== index,
														),
													)
												}
											>
												<Icon name="close" size="sm" />
											</button>
										)}
									</div>
								);
							})}
						</div>
					</Card>
				</div>

				{/* ------------------------------------------------ right */}
				<div className={styles.right}>
					<Card
						title={`Crew (${draft.assignedUserIds.length})`}
						actions={
							draft.assignedUserIds.length > 0 && (
								<button
									className={styles.clear}
									onClick={() => set({ assignedUserIds: [] })}
								>
									Clear
								</button>
							)
						}
					>
						<div className={styles.stack}>
							{/*
							 * The crew is a STATEMENT — "you are working this" —
							 * not a question. Nobody assigned here is asked
							 * anything; that is what the card below is for.
							 */}
							<Text variant="caption" tone="secondary">
								Who is actually working it. Assigning does not
								ask them — it tells them.
							</Text>

							{assignedWithoutReply.length > 0 && (
								<div className={styles.reachWarning}>
									<Icon name="warning" size="sm" />
									<Text variant="caption" as="span">
										{assignedWithoutReply.length}{" "}
										{assignedWithoutReply.length === 1
											? "person is"
											: "people are"}{" "}
										assigned while still invited below.
										Their reply can no longer reach you —
										assigning removes the event from the
										Availability tab.
									</Text>
								</div>
							)}

							<Input
								icon="search"
								placeholder="Find a worker"
								value={workerQuery}
								onChange={(e) => setWorkerQuery(e.target.value)}
							/>
							<ul className={styles.workerList}>
								{workers.map((member) => {
									const chosen =
										draft.assignedUserIds.includes(
											member.userId,
										);
									const clash = bookedElsewhere.get(
										member.userId,
									);
									return (
										<li key={member.id}>
											<label className={styles.workerRow}>
												<input
													type="checkbox"
													checked={chosen}
													onChange={() =>
														set({
															assignedUserIds:
																chosen
																	? draft.assignedUserIds.filter(
																			(
																				id,
																			) =>
																				id !==
																				member.userId,
																		)
																	: [
																			...draft.assignedUserIds,
																			member.userId,
																		],
														})
													}
												/>
												<span
													className={
														styles.workerMain
													}
												>
													<Text
														variant="body"
														as="span"
														clamp={1}
													>
														{member.firstName}{" "}
														{member.lastName}
													</Text>
													{/*
													 * Already working that day.
													 * The phone cannot show
													 * this while you pick.
													 */}
													{clash && (
														<span
															className={
																styles.clash
															}
															title={clash.join(
																", ",
															)}
														>
															<Icon
																name="warning"
																size="xs"
															/>
															already on{" "}
															{clash.length === 1
																? clash[0]
																: `${clash.length} events`}
														</span>
													)}
												</span>
												{member.role !== Role.USER && (
													<Badge tone="info">
														{member.role}
													</Badge>
												)}
											</label>
										</li>
									);
								})}
							</ul>
						</div>
					</Card>

					<Card title="Ask who's available">
						<div className={styles.stack}>
							{/*
							 * The relationship between this card and the crew
							 * above is not obvious from the data model, so it is
							 * spelled out. Two facts drive it:
							 *
							 *   syncEventAudience creates an invitation only for
							 *   the AUDIENCE — never for someone merely assigned.
							 *
							 *   getAvailabilityEvents skips any event with
							 *   assignedCount !== 0, so assigning anyone removes
							 *   the event from every worker's Availability tab.
							 *
							 * So asking has to happen while the crew is empty.
							 */}
							<Text variant="caption" tone="secondary">
								These people get asked whether they can work it.
								Assign the crew afterwards, once replies are in.
							</Text>

							{draft.assignedUserIds.length > 0 && (
								<div className={styles.reachWarning}>
									<Icon name="warning" size="sm" />
									<Text variant="caption" as="span">
										The crew is not empty, so this event no
										longer appears in anyone's Availability
										tab — nobody new can reply to it.
									</Text>
								</div>
							)}

							{groups.length > 0 && (
								<>
									<Text variant="label" tone="secondary">
										Groups
									</Text>
									{groups.map((group) => {
										const chosen =
											draft.audienceGroupIds.includes(
												group.id,
											);
										return (
											<label
												key={group.id}
												className={styles.checkRow}
											>
												<input
													type="checkbox"
													checked={chosen}
													onChange={() =>
														set({
															audienceGroupIds:
																chosen
																	? draft.audienceGroupIds.filter(
																			(
																				id,
																			) =>
																				id !==
																				group.id,
																		)
																	: [
																			...draft.audienceGroupIds,
																			group.id,
																		],
														})
													}
												/>
												<Text variant="body" as="span">
													{group.name}
												</Text>
											</label>
										);
									})}
								</>
							)}

							{/*
							 * Named individuals. audienceUserIds has always been
							 * in the schema and the service — there was simply no
							 * UI for it, so "ask these three people" was not
							 * expressible in either client.
							 */}
							<Text variant="label" tone="secondary">
								Specific people
							</Text>
							<Input
								icon="search"
								placeholder="Find someone to ask"
								value={askQuery}
								onChange={(e) => setAskQuery(e.target.value)}
							/>
							<ul className={styles.workerList}>
								{askable.map((member) => {
									const chosen =
										draft.audienceUserIds.includes(
											member.userId,
										);
									const viaGroup = (
										member.groupIds ?? []
									).some((id) =>
										draft.audienceGroupIds.includes(id),
									);
									const clash = bookedElsewhere.get(
										member.userId,
									);
									return (
										<li key={member.id}>
											<label
												className={styles.workerRow}
												title={
													viaGroup
														? "Already being asked through a group"
														: undefined
												}
											>
												<input
													type="checkbox"
													checked={chosen || viaGroup}
													disabled={viaGroup}
													onChange={() =>
														set({
															audienceUserIds:
																chosen
																	? draft.audienceUserIds.filter(
																			(
																				id,
																			) =>
																				id !==
																				member.userId,
																		)
																	: [
																			...draft.audienceUserIds,
																			member.userId,
																		],
														})
													}
												/>
												<span
													className={
														styles.workerMain
													}
												>
													<Text
														variant="body"
														as="span"
														clamp={1}
													>
														{member.firstName}{" "}
														{member.lastName}
													</Text>
													{viaGroup && (
														<Text
															variant="caption"
															tone="tertiary"
															as="span"
														>
															via group
														</Text>
													)}
													{!viaGroup && clash && (
														<span
															className={
																styles.clash
															}
															title={clash.join(
																", ",
															)}
														>
															<Icon
																name="warning"
																size="xs"
															/>
															busy that day
														</span>
													)}
												</span>
											</label>
										</li>
									);
								})}
							</ul>

							{/*
							 * The consequence, computed live. "Visible to 23
							 * people" is the question an admin is actually
							 * asking; the app leaves them to infer it.
							 */}
							<div
								className={
									audienceReach === 0
										? styles.reachWarning
										: styles.reach
								}
							>
								<Icon
									name={
										audienceReach === 0
											? "warning"
											: "people-outline"
									}
									size="sm"
								/>
								<Text variant="caption" as="span">
									{audienceReach === null
										? "Open to everyone in the company"
										: audienceReach === 0
											? "Nobody can see this — pick a group, or leave all unticked"
											: `Visible to ${audienceReach} ${
													audienceReach === 1
														? "person"
														: "people"
												}`}
								</Text>
							</div>
						</div>
					</Card>

					{packages.length > 0 && (
						<Card title="Packages">
							<div className={styles.stack}>
								{packages.map((pkg) => {
									const chosen = draft.packageIds.includes(
										pkg.id,
									);
									return (
										<label
											key={pkg.id}
											className={styles.checkRow}
										>
											<input
												type="checkbox"
												checked={chosen}
												onChange={() =>
													set({
														packageIds: chosen
															? draft.packageIds.filter(
																	(id) =>
																		id !==
																		pkg.id,
																)
															: [
																	...draft.packageIds,
																	pkg.id,
																],
													})
												}
											/>
											<span>
												<Text variant="body" as="span">
													{pkg.title}
												</Text>
												<Text
													variant="caption"
													tone="tertiary"
													as="span"
												>
													{pkg.checklistIds?.length ??
														0}{" "}
													checklist
													{pkg.checklistIds
														?.length === 1
														? ""
														: "s"}
												</Text>
											</span>
										</label>
									);
								})}
							</div>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ dates */

const clockOf = (date: Date) =>
	`${String(date.getHours()).padStart(2, "0")}:${String(
		date.getMinutes(),
	).padStart(2, "0")}`;

/** Local time on the given calendar day — never parsed as UTC. */
function combine(dateKey: string, clock: string): Date {
	const [year, month, day] = dateKey.split("-").map(Number);
	const [hour, minute] = clock.split(":").map(Number);
	return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function durationLabel(start: string, end: string): string {
	const [sh, sm] = start.split(":").map(Number);
	const [eh, em] = end.split(":").map(Number);
	const minutes = eh * 60 + em - (sh * 60 + sm);
	if (minutes <= 0) return "—";
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
