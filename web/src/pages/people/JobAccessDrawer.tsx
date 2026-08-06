import { useEffect, useState } from "react";
import {
	setMemberGroups,
	setMemberVisibility,
} from "@app/services/groupService";
import { useGroups } from "@app/hooks/useGroups";
import { Role } from "@app/types/enums/Role";
import type { Membership, WorkerVisibility } from "@app/types";
import { useCompany } from "../../contexts/CompanyContext";
import { Badge, Button, Icon, Text, useToast } from "../../ui";
import styles from "./JobAccessDrawer.module.css";

/*
 * Per-member detail, and the job-access editor.
 *
 * The app puts this behind a modal reached from a button on a row
 * (EmployeeList's JobAccessModal). On a desktop it is a drawer beside the
 * table, so the roster stays visible and an admin can work down it without
 * losing their place.
 *
 * Writes go through the same two services the app calls —
 * `setMemberVisibility` and `setMemberGroups` — so the resulting documents are
 * identical whichever client made the change.
 *
 * Changes are applied on Save rather than per-toggle: switching a worker to
 * restricted and picking their groups is one intent, and firing a write per
 * checkbox would leave them briefly visible-to-nothing.
 */
export function JobAccessDrawer({
	member,
	onClose,
}: {
	member: Membership;
	onClose: () => void;
}) {
	const { companyId } = useCompany();
	const { groups } = useGroups(companyId);
	const toast = useToast();

	const [visibility, setVisibility] = useState<WorkerVisibility>(
		member.visibility ?? "open",
	);
	const [groupIds, setGroupIds] = useState<string[]>(member.groupIds ?? []);
	const [saving, setSaving] = useState(false);

	// The roster is a live subscription, so `member` can change underneath the
	// drawer — re-seed when a different person is opened.
	useEffect(() => {
		setVisibility(member.visibility ?? "open");
		setGroupIds(member.groupIds ?? []);
	}, [member.id, member.visibility, member.groupIds]);

	const dirty =
		visibility !== (member.visibility ?? "open") ||
		groupIds.length !== (member.groupIds ?? []).length ||
		groupIds.some((id) => !(member.groupIds ?? []).includes(id));

	const stranded = visibility === "restricted" && groupIds.length === 0;

	async function save() {
		setSaving(true);
		try {
			if (visibility !== (member.visibility ?? "open")) {
				await setMemberVisibility(companyId, member.userId, visibility);
			}
			await setMemberGroups(companyId, member.userId, groupIds);
			toast.success(`Updated ${member.firstName}'s job access`);
		} catch (error) {
			toast.error(
				"Could not save job access",
				error instanceof Error ? error.message : undefined,
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<aside className={styles.drawer} aria-label="Member detail">
			<header className={styles.header}>
				<div className={styles.identity}>
					<Text variant="heading" as="h2">
						{member.firstName} {member.lastName}
					</Text>
					<Badge
						tone={
							member.role === Role.OWNER
								? "accent"
								: member.role === Role.MANAGER
									? "info"
									: "neutral"
						}
					>
						{member.role}
					</Badge>
				</div>
				<button
					className={styles.close}
					onClick={onClose}
					aria-label="Close"
				>
					<Icon name="close" size="sm" />
				</button>
			</header>

			<div className={styles.body}>
				<section className={styles.section}>
					<Text variant="overline" tone="tertiary">
						Contact
					</Text>
					<Row
						label="Email"
						value={member.email}
						href={`mailto:${member.email}`}
					/>
					<Row
						label="Phone"
						value={member.phone ?? "—"}
						href={member.phone ? `tel:${member.phone}` : undefined}
					/>
					<Row
						label="Joined"
						value={
							member.joinedAt
								? member.joinedAt.toDate().toLocaleDateString()
								: "—"
						}
					/>
					{member.joinedViaCode && (
						<Row
							label="Join code"
							value={member.joinedViaCode}
							mono
						/>
					)}
				</section>

				{member.role === Role.USER ? (
					<section className={styles.section}>
						<Text variant="overline" tone="tertiary">
							Job access
						</Text>

						<div className={styles.choices}>
							<Choice
								selected={visibility === "open"}
								onSelect={() => setVisibility("open")}
								title="Open"
								description="Sees every job that is not targeted at specific groups, plus any invitation."
							/>
							<Choice
								selected={visibility === "restricted"}
								onSelect={() => setVisibility("restricted")}
								title="Restricted"
								description="Only sees jobs they are explicitly invited to, through a group or by name."
							/>
						</div>

						<Text variant="overline" tone="tertiary">
							Groups
						</Text>

						{groups.length === 0 ? (
							<Text variant="caption" tone="tertiary">
								No worker groups yet. Create one from the Groups
								page to target jobs.
							</Text>
						) : (
							<ul className={styles.groupList}>
								{groups.map((group) => {
									const checked = groupIds.includes(group.id);
									return (
										<li key={group.id}>
											<label className={styles.groupRow}>
												<input
													type="checkbox"
													checked={checked}
													onChange={() =>
														setGroupIds(
															(current) =>
																checked
																	? current.filter(
																			(
																				id,
																			) =>
																				id !==
																				group.id,
																		)
																	: [
																			...current,
																			group.id,
																		],
														)
													}
												/>
												<Text variant="body" as="span">
													{group.name}
												</Text>
											</label>
										</li>
									);
								})}
							</ul>
						)}

						{stranded && (
							<div className={styles.warning}>
								<Icon name="warning" size="sm" />
								<Text variant="caption" as="span">
									Restricted with no groups — this worker will
									see no jobs at all.
								</Text>
							</div>
						)}
					</section>
				) : (
					<section className={styles.section}>
						<Text variant="overline" tone="tertiary">
							Job access
						</Text>
						<Text variant="caption" tone="tertiary">
							{member.role === Role.OWNER ? "Owners" : "Managers"}{" "}
							see every job in the company, so job access does not
							apply.
						</Text>
					</section>
				)}
			</div>

			{member.role === Role.USER && (
				<footer className={styles.footer}>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={save}
						busy={saving}
						disabled={!dirty}
					>
						Save changes
					</Button>
				</footer>
			)}
		</aside>
	);
}

function Row({
	label,
	value,
	href,
	mono,
}: {
	label: string;
	value: string;
	href?: string;
	mono?: boolean;
}) {
	return (
		<div className={styles.row}>
			<Text variant="caption" tone="tertiary" as="span">
				{label}
			</Text>
			{href ? (
				<a href={href} className={styles.link}>
					{value}
				</a>
			) : (
				<Text variant="body" as="span" mono={mono} clamp={1}>
					{value}
				</Text>
			)}
		</div>
	);
}

function Choice({
	selected,
	onSelect,
	title,
	description,
}: {
	selected: boolean;
	onSelect: () => void;
	title: string;
	description: string;
}) {
	return (
		<button
			className={[styles.choice, selected ? styles.choiceActive : ""]
				.filter(Boolean)
				.join(" ")}
			onClick={onSelect}
			aria-pressed={selected}
		>
			<span className={styles.choiceHead}>
				<Icon
					name={selected ? "checkmark-circle" : "ellipse-outline"}
					size="sm"
				/>
				<Text variant="bodyStrong" as="span">
					{title}
				</Text>
			</span>
			<Text variant="caption" tone="secondary" as="span">
				{description}
			</Text>
		</button>
	);
}
