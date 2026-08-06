import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { EventResponseStatus } from "@app/types";
import { useCompany } from "../../contexts/CompanyContext";
import {
	Badge,
	Button,
	EmptyState,
	Icon,
	LoadingPane,
	MiniBar,
	Text,
	Textarea,
	useToast,
} from "../../ui";
import { useEventDrawer, type RosterRow } from "./useEventDrawer";
import styles from "./EventDrawer.module.css";

/*
 * One event, in a drawer beside the calendar.
 *
 * The centrepiece is the ROSTER TABLE. In the app, who is assigned and who has
 * replied live on two different screens — the event detail lists names, and the
 * availability sheet holds responses. An admin chasing an under-staffed job has
 * to hold both in their head.
 *
 * Here one row per worker carries: name, role, their response as a CLICKABLE
 * pill, and a warning if they are double-booked that day. Changing someone's
 * answer is one click, in the same place you noticed it was missing.
 */

const STATUSES: {
	value: EventResponseStatus;
	label: string;
	tone: "success" | "warning" | "danger";
}[] = [
	{ value: "confirmed", label: "Confirmed", tone: "success" },
	{ value: "pending", label: "Pending", tone: "warning" },
	{ value: "declined", label: "Declined", tone: "danger" },
];

export function EventDrawer() {
	const { eventId, companyId } = useParams<{
		eventId: string;
		companyId: string;
	}>();
	const navigate = useNavigate();
	const toast = useToast();
	const { preferences } = useCompany();

	const {
		event,
		label,
		roster,
		invitedOnly,
		attachments,
		packages,
		checklists,
		isLoading,
		notFound,
		setResponse,
		saveAdminNotes,
	} = useEventDrawer(eventId ?? "");

	const [notes, setNotes] = useState<string | null>(null);
	const [savingNotes, setSavingNotes] = useState(false);

	const close = () => navigate(`/${companyId}/calendar`);

	if (isLoading) {
		return (
			<aside className={styles.drawer}>
				<LoadingPane />
			</aside>
		);
	}

	if (notFound || !event) {
		return (
			<aside className={styles.drawer}>
				<EmptyState
					tone="error"
					title="Event not found"
					description="It may have been deleted, or you may not have access to it."
					action={
						<Button variant="secondary" onClick={close}>
							Back to calendar
						</Button>
					}
				/>
			</aside>
		);
	}

	const counts = event.responseCounts;
	const confirmed = counts?.confirmed ?? 0;
	const needed = event.assignedCount ?? 0;

	/*
	 * Acknowledgement is counted from the roster rather than from
	 * responseCounts, which tracks the AVAILABILITY answer only. The two
	 * questions have different answers and must not be conflated.
	 */
	const acked = roster.filter((row) => row.acknowledged).length;

	async function changeResponse(
		targetUserId: string,
		status: EventResponseStatus,
		name: string,
	) {
		try {
			await setResponse(targetUserId, status);
			toast.success(`${name} marked ${status}`);
		} catch (error) {
			toast.error(
				"Could not update the response",
				error instanceof Error ? error.message : undefined,
			);
		}
	}

	async function commitNotes() {
		if (notes === null || notes === event.adminNotes) return;
		setSavingNotes(true);
		try {
			await saveAdminNotes(notes);
			toast.success("Notes saved");
		} catch (error) {
			toast.error(
				"Could not save notes",
				error instanceof Error ? error.message : undefined,
			);
		} finally {
			setSavingNotes(false);
		}
	}

	return (
		<aside className={styles.drawer} aria-label="Event detail">
			<header className={styles.header}>
				<div className={styles.headerMain}>
					<div className={styles.titleRow}>
						{label && (
							<span
								className={styles.labelDot}
								style={{ background: label.color }}
								title={label.name}
							/>
						)}
						<Text variant="heading" as="h2" clamp={2}>
							{event.title}
						</Text>
					</div>
					<Text variant="caption" tone="secondary">
						{formatWhen(event)}
					</Text>
				</div>
				<button
					className={styles.close}
					onClick={close}
					aria-label="Close"
				>
					<Icon name="close" size="sm" />
				</button>
			</header>

			<div className={styles.actions}>
				<Button
					variant="secondary"
					size="small"
					icon="pencil"
					onClick={() =>
						navigate(`/${companyId}/events/${event.id}/edit`)
					}
				>
					Edit
				</Button>
				<Button
					variant="ghost"
					size="small"
					icon="albums-outline"
					disabled
				>
					Checklists
				</Button>
			</div>

			<div className={styles.body}>
				{/* ------------------------------------------ staffing */}
				<section className={styles.section}>
					<div className={styles.sectionHead}>
						<Text variant="overline" tone="tertiary">
							Crew ({roster.length})
						</Text>
						<span className={styles.mix}>
							<MiniBar
								confirmed={confirmed}
								pending={counts?.pending}
								declined={counts?.declined}
								needed={needed}
								width={64}
							/>
							<Text variant="caption" tone="secondary" as="span">
								{confirmed}/{needed} confirmed · {acked}/
								{roster.length} seen it
							</Text>
						</span>
					</div>

					{roster.length === 0 ? (
						<div className={styles.warnBox}>
							<Icon name="warning" size="sm" />
							<Text variant="caption" as="span">
								Nobody is assigned to this event yet.
							</Text>
						</div>
					) : (
						<table className={styles.roster}>
							<tbody>
								{roster.map((row) => (
									<RosterRowView
										key={row.member.userId}
										row={row}
										onSet={(status) =>
											changeResponse(
												row.member.userId,
												status,
												row.member.firstName,
											)
										}
									/>
								))}
							</tbody>
						</table>
					)}

					{invitedOnly.length > 0 && (
						<>
							<Text variant="caption" tone="tertiary">
								Invited but not on the crew
							</Text>
							<ul className={styles.invitedList}>
								{invitedOnly.map((row) => (
									<li
										key={row.member!.userId}
										className={styles.invitedRow}
									>
										<Text variant="caption" as="span">
											{row.member!.firstName}{" "}
											{row.member!.lastName}
										</Text>
										<Badge
											tone={
												row.status === "confirmed"
													? "success"
													: row.status === "declined"
														? "danger"
														: "warning"
											}
										>
											{row.status}
										</Badge>
									</li>
								))}
							</ul>
						</>
					)}
				</section>

				{/* ------------------------------------------ audience */}
				<section className={styles.section}>
					<Text variant="overline" tone="tertiary">
						Published to
					</Text>
					{!event.isTargeted ? (
						<Text variant="body" tone="secondary">
							Everyone in the company who can see jobs.
						</Text>
					) : (event.audienceGroupIds?.length ?? 0) +
							(event.audienceUserIds?.length ?? 0) ===
					  0 ? (
						<div className={styles.warnBox}>
							<Icon name="warning" size="sm" />
							<Text variant="caption" as="span">
								This event is targeted but has no audience — no
								worker can see it.
							</Text>
						</div>
					) : (
						<div className={styles.chips}>
							{(event.audienceGroupIds ?? []).map((id) => (
								<Badge
									key={id}
									tone="accent"
									icon="albums-outline"
								>
									{id}
								</Badge>
							))}
							{(event.audienceUserIds ?? []).length > 0 && (
								<Badge tone="neutral">
									{event.audienceUserIds.length} named worker
									{event.audienceUserIds.length === 1
										? ""
										: "s"}
								</Badge>
							)}
						</div>
					)}
				</section>

				{/* ----------------------------------------- locations */}
				{Object.keys(event.locations ?? {}).length > 0 && (
					<section className={styles.section}>
						<Text variant="overline" tone="tertiary">
							Where
						</Text>
						{Object.entries(event.locations).map(
							([address, location]) => (
								<a
									key={address}
									className={styles.location}
									href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
										address,
									)}`}
									target="_blank"
									rel="noopener noreferrer"
								>
									<Icon name="location-outline" size="sm" />
									<span className={styles.locationText}>
										{location?.label && (
											<Text
												variant="bodyStrong"
												as="span"
											>
												{location.label}
											</Text>
										)}
										<Text
											variant="caption"
											tone="secondary"
											as="span"
										>
											{address}
										</Text>
									</span>
									<Icon name="open-outline" size="xs" />
								</a>
							),
						)}
					</section>
				)}

				{/* --------------------------------------------- notes */}
				<section className={styles.section}>
					<Text variant="overline" tone="tertiary">
						Admin notes
					</Text>
					<Textarea
						value={notes ?? event.adminNotes ?? ""}
						onChange={(e) => setNotes(e.target.value)}
						onBlur={commitNotes}
						placeholder="Notes only admins can see"
						rows={3}
						disabled={savingNotes}
					/>
					{event.workerNotes?.trim() && (
						<>
							<Text variant="overline" tone="tertiary">
								Worker notes
							</Text>
							<div className={styles.readOnlyNotes}>
								<Text variant="body">{event.workerNotes}</Text>
							</div>
						</>
					)}
				</section>

				{/* ---------------------------------- packages/checklists */}
				{(packages.length > 0 ||
					Object.keys(checklists).length > 0) && (
					<section className={styles.section}>
						<Text variant="overline" tone="tertiary">
							Checklists
						</Text>
						{packages.map((pkg) => (
							<div key={pkg.id} className={styles.package}>
								<Text variant="bodyStrong">{pkg.title}</Text>
								<ul className={styles.checklistList}>
									{(pkg.checklistIds ?? []).map((id) => (
										<li key={id}>
											<Text
												variant="caption"
												tone="secondary"
											>
												{checklists[id]?.title ?? id}
												{checklists[id]?.items && (
													<>
														{" · "}
														{
															checklists[id].items
																.length
														}{" "}
														items
													</>
												)}
											</Text>
										</li>
									))}
								</ul>
							</div>
						))}
					</section>
				)}

				{/* --------------------------------------- attachments */}
				{attachments.length > 0 && (
					<section className={styles.section}>
						<Text variant="overline" tone="tertiary">
							Files ({attachments.length})
						</Text>
						<div className={styles.files}>
							{attachments.map((file) => (
								<a
									key={file.id}
									href={file.downloadUrl}
									target="_blank"
									rel="noopener noreferrer"
									className={styles.file}
									title={file.fileName}
								>
									{file.thumbnailDownloadUrl ? (
										<img
											src={file.thumbnailDownloadUrl}
											alt={file.fileName}
										/>
									) : (
										<Icon
											name="document-outline"
											size="md"
										/>
									)}
								</a>
							))}
						</div>
					</section>
				)}

				{/* ------------------------------------------ metadata */}
				<section className={styles.meta}>
					<Text variant="caption" tone="tertiary">
						Created {formatStamp(event.createdAt)} · updated{" "}
						{formatStamp(event.updatedAt)}
					</Text>
					{/* The raw id, for support. Copyable rather than a screenshot. */}
					<button
						className={styles.idButton}
						onClick={() => {
							void navigator.clipboard
								?.writeText(event.id)
								.then(() => toast.success("Event ID copied"))
								.catch(() => {});
						}}
					>
						<Text variant="caption" tone="tertiary" as="span" mono>
							{event.id}
						</Text>
						<Icon name="copy-outline" size="xs" />
					</button>
					{preferences.allowUserEventEditing && (
						<Text variant="caption" tone="tertiary">
							Assigned workers can edit this event.
						</Text>
					)}
				</section>
			</div>
		</aside>
	);
}

/* ------------------------------------------------------------- roster row */

function RosterRowView({
	row,
	onSet,
}: {
	row: RosterRow;
	onSet: (status: EventResponseStatus) => void;
}) {
	const [open, setOpen] = useState(false);
	const current = STATUSES.find((s) => s.value === row.status);

	return (
		<tr className={styles.rosterRow}>
			<td className={styles.rosterName}>
				<Text variant="body" as="span" clamp={1}>
					{row.member.firstName} {row.member.lastName}
				</Text>

				{/*
				 * Acknowledgement, distinct from the availability answer beside
				 * it. Someone can have confirmed they were free weeks ago and
				 * still not have seen that the shift became real.
				 */}
				{row.acknowledged ? (
					<span className={styles.acked}>
						<Icon name="checkmark-circle" size="xs" />
						seen it
					</span>
				) : (
					<span className={styles.unacked}>
						<Icon name="time-outline" size="xs" />
						not seen yet
					</span>
				)}
				{/*
				 * Double booking. The app cannot show this without leaving the
				 * screen; here it sits in the row you are already reading.
				 */}
				{row.conflicts.length > 0 && (
					<span
						className={styles.conflict}
						title={`Also on: ${row.conflicts
							.map((e) => e.title)
							.join(", ")}`}
					>
						<Icon name="warning" size="xs" />
						{row.conflicts.length === 1
							? "double-booked"
							: `on ${row.conflicts.length + 1} events`}
					</span>
				)}
			</td>
			<td className={styles.rosterStatus}>
				<div className={styles.statusWrap}>
					<button
						className={styles.statusButton}
						onClick={() => setOpen((v) => !v)}
						aria-expanded={open}
					>
						<Badge tone={current?.tone ?? "neutral"} dot>
							{current?.label ?? "No reply"}
						</Badge>
						<Icon name="chevron-down" size="xs" />
					</button>
					{open && (
						<>
							<div
								className={styles.backdrop}
								onClick={() => setOpen(false)}
							/>
							<div className={styles.statusMenu}>
								{STATUSES.map((status) => (
									<button
										key={status.value}
										className={styles.statusOption}
										onClick={() => {
											setOpen(false);
											onSet(status.value);
										}}
									>
										<Badge tone={status.tone} dot>
											{status.label}
										</Badge>
										{row.status === status.value && (
											<Icon name="checkmark" size="xs" />
										)}
									</button>
								))}
							</div>
						</>
					)}
				</div>
			</td>
		</tr>
	);
}

/* ----------------------------------------------------------------- format */

function formatWhen(event: {
	dateKey: string;
	isAllDay: boolean;
	startAt?: { toDate?: () => Date } | null;
	endAt?: { toDate?: () => Date } | null;
}): string {
	const date = new Date(`${event.dateKey}T12:00:00`).toLocaleDateString(
		undefined,
		{ weekday: "long", month: "long", day: "numeric" },
	);
	if (event.isAllDay) return `${date} · all day`;

	const start = event.startAt?.toDate?.();
	const end = event.endAt?.toDate?.();
	if (!start) return date;

	const time = (d: Date) =>
		d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

	const span = end
		? ` · ${time(start)}–${time(end)} (${(
				(end.getTime() - start.getTime()) /
				3_600_000
			).toFixed(1)}h)`
		: ` · ${time(start)}`;

	return date + span;
}

function formatStamp(stamp?: { toDate?: () => Date } | null): string {
	const date = stamp?.toDate?.();
	return date ? date.toLocaleDateString() : "—";
}
