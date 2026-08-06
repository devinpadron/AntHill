import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFormSchema } from "@app/hooks/useFormSchema";
import {
	formatDuration,
	getStatusBadgeText,
	getStatusTone,
} from "@app/utils/timeUtils";
import type { TimeEntry, TimeEntryConnection } from "@app/types";
import { useCompany } from "../../contexts/CompanyContext";
import { Badge, Card, EmptyState, Icon, Text } from "../../ui";
import { netSecondsOf, type EmployeeTotals } from "./usePayroll";
import { FormResponseList } from "./FormResponseList";
import { useEntryEdits } from "./useEntryEdits";
import styles from "./WeekView.module.css";

/*
 * One employee's whole period, expanded.
 *
 * The entries table answers "how many hours" well and "what actually happened"
 * badly — every form answer, every event worked and every note is behind a
 * click, so reconciling a week means opening six entries in turn and holding
 * them all in your head.
 *
 * This lays the period out as days, each with its shifts, each shift with its
 * times, the events worked and the form answers already visible. It is the
 * screen you use when approving a week rather than inspecting one entry.
 *
 * Every answer is editable in place — correcting a tip figure across six
 * shifts is exactly the job this view exists for.
 *
 * Order within a shift is deliberate: the EVENTS worked and their forms come
 * first, then the general timesheet form. A shift is a set of jobs and that
 * form summarises them, so reading the summary before knowing which jobs it
 * covers is backwards.
 */
export function WeekView({
	employee,
	dayKeys,
	connectionsByEntry,
	onConnectionsChanged,
}: {
	employee: EmployeeTotals;
	dayKeys: string[];
	/** Fetched once for the period by PayrollPage — see useConnections. */
	connectionsByEntry: Record<string, TimeEntryConnection[]>;
	onConnectionsChanged: () => void;
}) {
	const { companyId } = useCompany();
	const navigate = useNavigate();
	const { companyId: routeCompanyId } = useParams<{ companyId: string }>();

	/*
	 * Schemas are per-entry, but in practice a period's entries share one — so
	 * they are resolved once from the first entry that names one, rather than
	 * per row. An entry submitted against an older version still renders: the
	 * labels come from the schema, and a field it does not know simply falls
	 * back to its id.
	 */
	const timeEntrySchemaId =
		employee.entries.find((e) => e.formSchemaIds?.timeEntry)?.formSchemaIds
			?.timeEntry ?? null;
	const eventSchemaId =
		employee.entries.find((e) => e.formSchemaIds?.event)?.formSchemaIds
			?.event ?? null;

	const { schema, checklists } = useFormSchema(timeEntrySchemaId, companyId);
	const { schema: eventSchema, checklists: eventChecklists } = useFormSchema(
		eventSchemaId,
		companyId,
	);
	const { saveEntryField, saveConnectionField } = useEntryEdits();

	const byDay = useMemo(() => {
		const map = new Map<string, TimeEntry[]>();
		for (const entry of employee.entries) {
			map.set(entry.dateKey, [...(map.get(entry.dateKey) ?? []), entry]);
		}
		for (const list of map.values()) {
			list.sort(
				(a, b) =>
					(a.clockInAt?.toMillis?.() ?? 0) -
					(b.clockInAt?.toMillis?.() ?? 0),
			);
		}
		return map;
	}, [employee.entries]);

	// Only days that were actually worked. A period of empty rows is noise.
	const workedDays = dayKeys.filter((key) => byDay.has(key));

	if (!workedDays.length) {
		return (
			<Card>
				<EmptyState
					icon="time-outline"
					title="Nothing recorded"
					description={`${employee.member.firstName} has no entries in this period.`}
				/>
			</Card>
		);
	}

	return (
		<div className={styles.wrap}>
			<div className={styles.summary}>
				<Stat label="Days" value={String(employee.days)} />
				<Stat
					label="Worked"
					value={formatDuration(employee.workedSeconds)}
				/>
				<Stat
					label="Paused"
					value={formatDuration(employee.pausedSeconds)}
				/>
				<Stat
					label="Net"
					value={formatDuration(employee.netSeconds)}
					strong
				/>
				{employee.pending > 0 && (
					<Badge tone="warning">{employee.pending} pending</Badge>
				)}
			</div>

			{workedDays.map((dayKey) => {
				const entries = byDay.get(dayKey)!;
				const dayNet = entries.reduce(
					(sum, entry) => sum + netSecondsOf(entry),
					0,
				);
				const date = new Date(`${dayKey}T12:00:00`);

				return (
					<Card key={dayKey} className={styles.day}>
						<div className={styles.dayHead}>
							<div>
								<Text variant="bodyStrong">
									{date.toLocaleDateString(undefined, {
										weekday: "long",
										month: "short",
										day: "numeric",
									})}
								</Text>
								<Text variant="caption" tone="tertiary">
									{entries.length} shift
									{entries.length === 1 ? "" : "s"}
								</Text>
							</div>
							<Text variant="title">
								{formatDuration(dayNet)}
							</Text>
						</div>

						{entries.map((entry) => (
							<div key={entry.id} className={styles.shift}>
								<div className={styles.shiftHead}>
									<span className={styles.times}>
										<Text variant="bodyStrong" as="span">
											{clock(entry.clockInAt)} –{" "}
											{entry.clockOutAt
												? clock(entry.clockOutAt)
												: "running"}
										</Text>
										<Text
											variant="caption"
											tone="tertiary"
											as="span"
										>
											{formatDuration(
												netSecondsOf(entry),
											)}{" "}
											net
											{entry.pausedSeconds
												? ` · ${formatDuration(entry.pausedSeconds)} paused`
												: ""}
										</Text>
									</span>

									<span className={styles.shiftMeta}>
										<Badge
											tone={getStatusTone(entry.status)}
											dot
										>
											{getStatusBadgeText(entry.status)}
										</Badge>
										{(entry.editCount ?? 0) > 0 && (
											<Badge tone="warning">
												{entry.editCount} edit
												{entry.editCount === 1
													? ""
													: "s"}
											</Badge>
										)}
										<button
											className={styles.open}
											onClick={() =>
												navigate(
													`/${routeCompanyId}/payroll/entries/${entry.id}`,
												)
											}
											title="Open this entry"
										>
											<Icon
												name="open-outline"
												size="sm"
											/>
										</button>
									</span>
								</div>

								{entry.notes?.trim() && (
									<div className={styles.notes}>
										<Icon
											name="document-text-outline"
											size="xs"
											className={styles.dim}
										/>
										<Text variant="caption">
											{entry.notes}
										</Text>
									</div>
								)}

								{(connectionsByEntry[entry.id] ?? []).map(
									(connection) => (
										<div
											key={connection.id}
											className={styles.connection}
										>
											<div
												className={
													styles.connectionHead
												}
											>
												<Icon
													name="calendar-outline"
													size="xs"
													className={styles.dim}
												/>
												<Text
													variant="bodyStrong"
													as="span"
												>
													{connection.customTitle ||
														connection.eventTitleSnapshot ||
														"Untitled event"}
												</Text>
											</div>
											{Object.keys(
												connection.formResponses ?? {},
											).length > 0 && (
												<FormResponseList
													schema={eventSchema}
													responses={
														connection.formResponses
													}
													checklists={eventChecklists}
													compact
													onSave={(
														field,
														next,
														previous,
													) =>
														saveConnectionField(
															entry,
															connection,
															field,
															next,
															previous,
														).then(
															onConnectionsChanged,
														)
													}
												/>
											)}

											{/*
											 * The general timesheet form comes LAST.
											 *
											 * A shift is a set of jobs; this form is a summary
											 * across them. Reading the summary before knowing
											 * which events it covers is backwards.
											 */}
											{/*
											 * Editable in place — this view exists so a
											 * manager can fix figures across a whole week
											 * without opening each entry.
											 */}
											{Object.keys(
												entry.formResponses ?? {},
											).length > 0 && (
												<div className={styles.answers}>
													<FormResponseList
														schema={schema}
														responses={
															entry.formResponses
														}
														checklists={checklists}
														compact
														onSave={(
															field,
															next,
															previous,
														) =>
															saveEntryField(
																entry,
																field,
																next,
																previous,
															)
														}
													/>
												</div>
											)}
										</div>
									),
								)}
							</div>
						))}
					</Card>
				);
			})}
		</div>
	);
}

function Stat({
	label,
	value,
	strong,
}: {
	label: string;
	value: string;
	strong?: boolean;
}) {
	return (
		<span className={styles.stat}>
			<Text variant={strong ? "title" : "bodyStrong"} as="span">
				{value}
			</Text>
			<Text variant="caption" tone="tertiary" as="span">
				{label}
			</Text>
		</span>
	);
}

const clock = (stamp?: { toDate?: () => Date } | null) => {
	const date = stamp?.toDate?.();
	return date
		? date.toLocaleTimeString(undefined, {
				hour: "numeric",
				minute: "2-digit",
			})
		: "—";
};
