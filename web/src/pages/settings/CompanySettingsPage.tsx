import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCompanyMembers } from "@app/hooks/useCompanyMembers";
import type { CompanyPreferences } from "@app/types";
import { useCompany } from "../../contexts/CompanyContext";
import { Badge, Button, Card, Icon, Input, Text, useToast } from "../../ui";
import styles from "./CompanySettingsPage.module.css";

/*
 * Company preferences.
 *
 * Every toggle here states its CONSEQUENCE, not just its name. The app renders
 * these as bare switches, which means an admin has to remember that
 * `enableAvailability` is the thing that makes the whole invitation flow exist.
 * Naming the effect in a sentence costs one line and removes the guesswork.
 *
 * All writes go through `updatePreferences`, which patches individual fields.
 * Never a whole-object write — a second admin client makes the stale-overwrite
 * hazard the app's comments warn about strictly worse.
 */
export function CompanySettingsPage() {
	const { companyId, company, preferences, timeZone, updatePreferences } =
		useCompany();
	const { members } = useCompanyMembers(companyId);
	const toast = useToast();
	const [busy, setBusy] = useState<string | null>(null);

	const activeCount = members.filter((m) => m.status === "active").length;

	async function patch(key: string, value: Partial<CompanyPreferences>) {
		setBusy(key);
		try {
			await updatePreferences(value);
			toast.success("Saved");
		} catch (error) {
			toast.error(
				"Could not save",
				error instanceof Error ? error.message : undefined,
			);
		} finally {
			setBusy(null);
		}
	}

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(company?.accessCode ?? "");
			toast.success("Access code copied");
		} catch {
			toast.warning("Could not copy", "Select the code and copy it.");
		}
	}

	/* The current time where the company is — a sanity check on the setting. */
	const localTime = useMemo(() => {
		try {
			return new Intl.DateTimeFormat(undefined, {
				timeStyle: "short",
				timeZone,
			}).format(new Date());
		} catch {
			return null;
		}
	}, [timeZone]);

	const weekPreview = useMemo(() => {
		const now = new Date();
		const startsMonday = preferences.workWeekStarts === "monday";
		const delta = startsMonday ? (now.getDay() + 6) % 7 : now.getDay();
		const start = new Date(now);
		start.setDate(now.getDate() - delta);
		const end = new Date(start);
		end.setDate(start.getDate() + 6);
		const fmt = (d: Date) =>
			d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
		return `${fmt(start)} – ${fmt(end)}`;
	}, [preferences.workWeekStarts]);

	return (
		<div className={styles.page}>
			<Text variant="display" as="h1">
				Company
			</Text>

			<div className={styles.grid}>
				<Card title="Identity">
					<dl className={styles.facts}>
						<Fact label="Name" value={company?.name ?? "—"} />
						<Fact
							label="Time zone"
							value={
								localTime
									? `${timeZone} · ${localTime} there now`
									: timeZone
							}
						/>
						<Fact label="Members" value={`${activeCount} active`} />
						<Fact label="Company ID" value={companyId} mono />
					</dl>

					<div className={styles.codeBlock}>
						<Text variant="label" tone="secondary">
							Access code
						</Text>
						<Text variant="caption" tone="tertiary">
							Anyone with this can join as a worker.
						</Text>
						<button
							className={styles.code}
							onClick={copyCode}
							title="Copy"
						>
							<span className={styles.codeValue}>
								{company?.accessCode ?? "…"}
							</span>
							<Icon name="copy-outline" size="sm" />
						</button>
					</div>
				</Card>

				<Card title="Work week">
					<Text variant="caption" tone="secondary">
						Where the payroll week starts. Changing it re-slices
						every period on the payroll page.
					</Text>
					<div className={styles.choiceRow}>
						{(["sunday", "monday"] as const).map((day) => (
							<button
								key={day}
								className={[
									styles.choice,
									preferences.workWeekStarts === day
										? styles.choiceActive
										: "",
								]
									.filter(Boolean)
									.join(" ")}
								onClick={() =>
									patch("week", { workWeekStarts: day })
								}
								disabled={busy === "week"}
							>
								<Text variant="bodyStrong" as="span">
									{day === "sunday" ? "Sunday" : "Monday"}
								</Text>
							</button>
						))}
					</div>
					<div className={styles.preview}>
						<Icon name="calendar-outline" size="sm" />
						<Text variant="caption" as="span">
							This week is <strong>{weekPreview}</strong>
						</Text>
					</div>
				</Card>

				<Card title="Features">
					<Toggle
						label="Timesheets"
						description="Adds the Clock tab in the app and the Payroll section here. Without it, nobody can record hours."
						checked={preferences.enableTimeSheet}
						busy={busy === "timesheet"}
						onChange={(v) =>
							patch("timesheet", { enableTimeSheet: v })
						}
						affects={activeCount}
					/>
					<Toggle
						label="Availability"
						description="Lets you publish events to groups and collect confirm/decline replies. Adds the Availability tab and worker groups."
						checked={preferences.enableAvailability}
						busy={busy === "availability"}
						onChange={(v) =>
							patch("availability", { enableAvailability: v })
						}
						affects={activeCount}
					/>
					<Toggle
						label="Workers can edit events"
						description="Assigned workers may change event details and their own time entries after submitting."
						checked={preferences.allowUserEventEditing}
						busy={busy === "editing"}
						onChange={(v) =>
							patch("editing", { allowUserEventEditing: v })
						}
						affects={activeCount}
					/>
					{/*
					 * Acknowledgement itself is always asked — an assignment
					 * nobody has seen is what it exists to prevent. This flag
					 * only decides whether the worker gets a second button.
					 */}
					<Toggle
						label="Workers can flag a problem with a shift"
						description="Assigned workers always confirm they've seen a shift. With this on, they can also say they can't make it — which flags it for you to resolve. It never unassigns them."
						checked={preferences.allowAssignmentDecline}
						busy={busy === "decline"}
						onChange={(v) =>
							patch("decline", { allowAssignmentDecline: v })
						}
						affects={activeCount}
					/>
					<Toggle
						label="Workers see event labels"
						description="Shows the colour-coded label on an event in the app. Admins always see them."
						checked={preferences.canViewEventLabels}
						busy={busy === "labels"}
						onChange={(v) =>
							patch("labels", { canViewEventLabels: v })
						}
						affects={activeCount}
					/>
				</Card>

				{preferences.enableAvailability && (
					<Card title="Reply reminders">
						<Text variant="caption" tone="secondary">
							How often to remind a worker who still has events
							awaiting a reply. One reminder covers all of them.
						</Text>

						<Toggle
							label="Send reminders"
							description=""
							checked={preferences.availabilityReminder?.enabled}
							busy={busy === "reminder"}
							onChange={(v) =>
								patch("reminder", {
									availabilityReminder: {
										...preferences.availabilityReminder,
										enabled: v,
									},
								})
							}
						/>

						{preferences.availabilityReminder?.enabled && (
							<>
								<div className={styles.durationRow}>
									<Input
										label="Every (hours)"
										type="number"
										min={0}
										value={String(
											preferences.availabilityReminder
												?.hours ?? 0,
										)}
										onChange={(e) =>
											patch("reminder", {
												availabilityReminder: {
													...preferences.availabilityReminder,
													hours:
														Number(
															e.target.value,
														) || 0,
												},
											})
										}
									/>
									<Input
										label="Minutes"
										type="number"
										min={0}
										max={59}
										value={String(
											preferences.availabilityReminder
												?.minutes ?? 0,
										)}
										onChange={(e) =>
											patch("reminder", {
												availabilityReminder: {
													...preferences.availabilityReminder,
													minutes:
														Number(
															e.target.value,
														) || 0,
												},
											})
										}
									/>
								</div>
								<div className={styles.preview}>
									<Icon name="time-outline" size="sm" />
									<Text variant="caption" as="span">
										Unanswered events are chased every{" "}
										<strong>
											{preferences.availabilityReminder
												?.hours ?? 0}
											h{" "}
											{preferences.availabilityReminder
												?.minutes ?? 0}
											m
										</strong>
										, in a single reminder per worker.
									</Text>
								</div>
							</>
						)}
					</Card>
				)}

				<Card title="Forms">
					<Text variant="caption" tone="secondary">
						Published forms are immutable and versioned — editing
						one publishes a new version, and entries already
						submitted keep the version they were answered against.
					</Text>

					<SchemaRow
						label="Timesheet form"
						schemaId={preferences.timeEntryFormSchemaId}
						to={`/${companyId}/settings/forms/timeEntryForm`}
					/>
					<SchemaRow
						label="Event form"
						schemaId={preferences.eventFormSchemaId}
						to={`/${companyId}/settings/forms/eventForm`}
					/>
				</Card>
			</div>
		</div>
	);
}

function SchemaRow({
	label,
	schemaId,
	to,
}: {
	label: string;
	schemaId: string | null;
	to: string;
}) {
	// Ids are `{companyId}_{kind}_v{n}` — the version is the useful part.
	const version = schemaId?.match(/_v(\d+)$/)?.[1];
	return (
		<Link to={to} className={styles.schemaRow}>
			<span className={styles.schemaMain}>
				<Text variant="body" as="span">
					{label}
				</Text>
				{version ? (
					<Badge tone="neutral">v{version}</Badge>
				) : (
					<Badge tone="warning">not set up</Badge>
				)}
			</span>
			<Icon name="chevron-forward" size="sm" />
		</Link>
	);
}

function Toggle({
	label,
	description,
	checked,
	onChange,
	busy,
	affects,
}: {
	label: string;
	description: string;
	checked?: boolean;
	onChange: (value: boolean) => void;
	busy?: boolean;
	affects?: number;
}) {
	return (
		<label className={styles.toggleRow}>
			<input
				type="checkbox"
				checked={Boolean(checked)}
				disabled={busy}
				onChange={(e) => onChange(e.target.checked)}
			/>
			<span className={styles.toggleText}>
				<Text variant="bodyStrong" as="span">
					{label}
				</Text>
				{description && (
					<Text variant="caption" tone="secondary" as="span">
						{description}
					</Text>
				)}
				{affects !== undefined && (
					<Text variant="caption" tone="tertiary" as="span">
						Affects {affects} member{affects === 1 ? "" : "s"}
					</Text>
				)}
			</span>
		</label>
	);
}

function Fact({
	label,
	value,
	mono,
}: {
	label: string;
	value: string;
	mono?: boolean;
}) {
	return (
		<div className={styles.fact}>
			<Text variant="caption" tone="tertiary" as="dt">
				{label}
			</Text>
			<Text variant="body" as="dd" mono={mono} clamp={1} title={value}>
				{value}
			</Text>
		</div>
	);
}
