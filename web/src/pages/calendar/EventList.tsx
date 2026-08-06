import { useNavigate } from "react-router-dom";
import type { Event, EventLabel, Membership } from "@app/types";
import {
	Badge,
	DataTable,
	EmptyState,
	Icon,
	MiniBar,
	Text,
	type Column,
} from "../../ui";
import styles from "./EventList.module.css";

/*
 * Every event in the window, as one sortable table.
 *
 * This is the page that most justifies the portal. On the phone, answering
 * "which of the next forty events is short-staffed, and who has not replied"
 * takes forty taps. Here it is one click on a column header.
 *
 * Columns are chosen so that nothing needs a second screen to interpret:
 * responses show as a bar AND numbers, audience says "Everyone" rather than
 * leaving an empty cell ambiguous, and an unassigned event turns its count red
 * instead of just showing 0.
 */
export function EventList({
	events,
	labelsById,
	members,
	isLoading,
}: {
	events: Event[];
	labelsById: Map<string, EventLabel>;
	members: Membership[];
	isLoading: boolean;
	canViewLabels?: boolean;
}) {
	const navigate = useNavigate();

	const nameFor = (userId: string) => {
		const member = members.find((m) => m.userId === userId);
		return member ? `${member.firstName} ${member.lastName}` : userId;
	};

	const columns: Column<Event>[] = [
		{
			id: "date",
			header: "Date",
			width: "116px",
			sortValue: (e) => e.dateKey,
			render: (e) => {
				const date = new Date(`${e.dateKey}T12:00:00`);
				return (
					<span className={styles.date}>
						<span className={styles.weekday}>
							{date.toLocaleDateString(undefined, {
								weekday: "short",
							})}
						</span>
						{date.toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
						})}
					</span>
				);
			},
		},
		{
			id: "time",
			header: "Time",
			width: "120px",
			sortValue: (e) => e.startAt?.toMillis?.() ?? 0,
			render: (e) => {
				if (e.isAllDay) {
					return (
						<Text variant="caption" tone="secondary" as="span">
							All day
						</Text>
					);
				}
				const start = e.startAt?.toDate?.();
				const end = e.endAt?.toDate?.();
				if (!start) return <Muted />;
				const fmt = (d: Date) =>
					d.toLocaleTimeString(undefined, {
						hour: "numeric",
						minute: "2-digit",
					});
				return (
					<span className={styles.time}>
						{fmt(start)}
						{end ? `–${fmt(end)}` : ""}
					</span>
				);
			},
		},
		{
			id: "title",
			header: "Event",
			sortValue: (e) => e.title,
			render: (e) => {
				const label = e.labelId ? labelsById.get(e.labelId) : undefined;
				return (
					<span className={styles.titleCell}>
						{label && (
							<span
								className={styles.labelDot}
								style={{ background: label.color }}
								title={label.name}
							/>
						)}
						<Text variant="bodyStrong" as="span" clamp={1}>
							{e.title}
						</Text>
					</span>
				);
			},
		},
		{
			id: "duration",
			header: "Hours",
			width: "72px",
			align: "right",
			optional: true,
			sortValue: (e) => e.durationSeconds ?? 0,
			render: (e) =>
				e.durationSeconds ? (
					<span className={styles.numeric}>
						{(e.durationSeconds / 3600).toFixed(1)}
					</span>
				) : (
					<Muted />
				),
		},
		{
			id: "location",
			header: "Location",
			sortValue: (e) => Object.keys(e.locations ?? {})[0] ?? "",
			render: (e) => {
				const addresses = Object.keys(e.locations ?? {});
				if (!addresses.length) return <Muted />;
				const first = e.locations[addresses[0]];
				return (
					<span
						className={styles.location}
						title={addresses.join("\n")}
					>
						<Icon
							name="location-outline"
							size="xs"
							className={styles.dim}
						/>
						<Text variant="caption" as="span" clamp={1}>
							{first?.label || addresses[0]}
						</Text>
						{addresses.length > 1 && (
							<Badge tone="neutral">
								+{addresses.length - 1}
							</Badge>
						)}
					</span>
				);
			},
		},
		{
			id: "assigned",
			header: "Staff",
			width: "80px",
			align: "right",
			sortValue: (e) => e.assignedCount ?? 0,
			render: (e) => (
				<span
					className={
						e.assignedCount ? styles.numeric : styles.numericAlert
					}
					title={
						e.assignedUserIds?.length
							? e.assignedUserIds.map(nameFor).join(", ")
							: "Nobody assigned"
					}
				>
					{e.assignedCount ?? 0}
				</span>
			),
			footer: (
				<span className={styles.numeric}>
					{events.reduce((n, e) => n + (e.assignedCount ?? 0), 0)}
				</span>
			),
		},
		{
			id: "responses",
			header: "Replies",
			width: "150px",
			sortValue: (e) => e.responseCounts?.confirmed ?? 0,
			render: (e) => {
				const counts = e.responseCounts;
				const answered =
					(counts?.confirmed ?? 0) +
					(counts?.pending ?? 0) +
					(counts?.declined ?? 0);
				if (!answered) return <Muted />;
				return (
					<span className={styles.responses}>
						<MiniBar
							confirmed={counts?.confirmed}
							pending={counts?.pending}
							declined={counts?.declined}
							needed={e.assignedCount}
						/>
						<span className={styles.responseNumbers}>
							<span className={styles.ok}>
								{counts?.confirmed ?? 0}
							</span>
							<span className={styles.wait}>
								{counts?.pending ?? 0}
							</span>
							<span className={styles.no}>
								{counts?.declined ?? 0}
							</span>
						</span>
					</span>
				);
			},
		},
		{
			id: "audience",
			header: "Published to",
			sortValue: (e) => (e.isTargeted ? 1 : 0),
			render: (e) => {
				if (!e.isTargeted) {
					return (
						<Text variant="caption" tone="secondary" as="span">
							Everyone
						</Text>
					);
				}
				const groups = e.audienceGroupIds?.length ?? 0;
				const users = e.audienceUserIds?.length ?? 0;
				// isTargeted with an empty audience means nobody can see it —
				// worth surfacing, not hiding behind a zero.
				if (!groups && !users) {
					return (
						<Badge tone="danger" icon="warning">
							Nobody
						</Badge>
					);
				}
				return (
					<span className={styles.audience}>
						{groups > 0 && (
							<Badge tone="accent">
								{groups} group{groups === 1 ? "" : "s"}
							</Badge>
						)}
						{users > 0 && <Badge tone="neutral">+{users}</Badge>}
					</span>
				);
			},
		},
		{
			id: "checklists",
			header: "Lists",
			width: "70px",
			align: "right",
			optional: true,
			sortValue: (e) => e.checklistIds?.length ?? 0,
			render: (e) =>
				e.checklistIds?.length ? (
					<span className={styles.numeric}>
						{e.checklistIds.length}
					</span>
				) : (
					<Muted />
				),
		},
		{
			id: "files",
			header: "Files",
			width: "64px",
			align: "right",
			optional: true,
			sortValue: (e) => e.attachmentCount ?? 0,
			render: (e) =>
				e.attachmentCount ? (
					<span className={styles.numeric}>{e.attachmentCount}</span>
				) : (
					<Muted />
				),
		},
		{
			id: "notes",
			header: "Notes",
			width: "60px",
			align: "center",
			render: (e) => {
				const hasAdmin = Boolean(e.adminNotes?.trim());
				const hasWorker = Boolean(e.workerNotes?.trim());
				if (!hasAdmin && !hasWorker) return <Muted />;
				return (
					<span
						className={styles.dim}
						title={
							[
								hasAdmin ? "Has admin notes" : "",
								hasWorker ? "Has worker notes" : "",
							]
								.filter(Boolean)
								.join(" · ") || undefined
						}
					>
						<Icon name="document-text-outline" size="xs" />
					</span>
				);
			},
		},
		{
			id: "updated",
			header: "Updated",
			width: "110px",
			optional: true,
			sortValue: (e) => e.updatedAt?.toMillis?.() ?? 0,
			render: (e) =>
				e.updatedAt ? (
					<Text variant="caption" tone="tertiary" as="span">
						{e.updatedAt.toDate().toLocaleDateString()}
					</Text>
				) : (
					<Muted />
				),
		},
	];

	return (
		<DataTable
			rows={events}
			columns={columns}
			rowKey={(e) => e.id}
			isLoading={isLoading}
			storageKey="calendar-list"
			onRowClick={(event) => navigate(`events/${event.id}`)}
			empty={
				<EmptyState
					icon="calendar-outline"
					title="No events in this window"
					description="Move to another month, or widen your filters."
				/>
			}
		/>
	);
}

const Muted = () => (
	<Text variant="caption" tone="tertiary" as="span">
		—
	</Text>
);
