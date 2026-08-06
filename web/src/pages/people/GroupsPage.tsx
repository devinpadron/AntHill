import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
	clearGroupJoinCode,
	createGroup,
	deleteGroup,
	renameGroup,
	setGroupJoinCode,
	setMemberGroups,
} from "@app/services/groupService";
import { useGroups } from "@app/hooks/useGroups";
import { useCompanyMembers } from "@app/hooks/useCompanyMembers";
import { showConfirmation } from "@app/utils/alertUtils";
import { Role } from "@app/types/enums/Role";
import type { Group, Membership, WorkerVisibility } from "@app/types";
import { useCompany } from "../../contexts/CompanyContext";
import {
	Badge,
	Button,
	Card,
	EmptyState,
	Icon,
	Input,
	Text,
	useToast,
} from "../../ui";
import styles from "./GroupsPage.module.css";

/*
 * Worker groups, two-pane: the list on the left, the selected group on the
 * right.
 *
 * Groups exist to target event audiences, so this page answers the question the
 * app's version cannot: WHO is in this group, and WHAT has been published to
 * them. The phone shows a name and a headcount.
 *
 * Every write goes through groupService — the same functions
 * WorkerGroups.tsx calls. Notably `setGroupJoinCode` retries on collision, which
 * only works because `.exists()` is a method; the shim preserves that, and the
 * conformance test covers it.
 *
 * The selected group lives in the URL (?group=), so a specific group is
 * linkable — an owner can send "here is the crew you asked about".
 */
export function GroupsPage() {
	const { companyId, isOwner } = useCompany();
	const { groups, isLoading } = useGroups(companyId);
	const { members } = useCompanyMembers(companyId);
	const toast = useToast();

	const [params, setParams] = useSearchParams();
	const selectedId = params.get("group");
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [busy, setBusy] = useState(false);

	const selected = groups.find((g) => g.id === selectedId) ?? null;

	// Land on the first group rather than an empty right pane.
	useEffect(() => {
		if (!selectedId && groups.length) {
			setParams({ group: groups[0].id }, { replace: true });
		}
	}, [selectedId, groups, setParams]);

	const membersByGroup = useMemo(() => {
		const map = new Map<string, Membership[]>();
		for (const member of members) {
			for (const id of member.groupIds ?? []) {
				const list = map.get(id) ?? [];
				list.push(member);
				map.set(id, list);
			}
		}
		return map;
	}, [members]);

	async function create() {
		const name = newName.trim();
		if (!name) return;
		setBusy(true);
		try {
			const id = await createGroup(companyId, name);
			setNewName("");
			setCreating(false);
			setParams({ group: id });
			toast.success(`Created ${name}`);
		} catch (error) {
			toast.error(
				"Could not create the group",
				error instanceof Error ? error.message : undefined,
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div>
					<Text variant="display" as="h1">
						Worker groups
					</Text>
					<Text variant="caption" tone="secondary">
						Groups decide who can see a job. Publish an event to a
						group and only its members are invited.
					</Text>
				</div>
			</header>

			<div className={styles.panes}>
				<Card flush className={styles.listPane}>
					<div className={styles.listHead}>
						<Text variant="overline" tone="tertiary">
							{groups.length} group
							{groups.length === 1 ? "" : "s"}
						</Text>
						<Button
							variant="ghost"
							size="small"
							icon="add"
							onClick={() => setCreating((v) => !v)}
						>
							New
						</Button>
					</div>

					{creating && (
						<div className={styles.createRow}>
							<Input
								autoFocus
								placeholder="Group name"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") void create();
									if (e.key === "Escape") setCreating(false);
								}}
							/>
							<Button
								variant="primary"
								size="small"
								onClick={create}
								busy={busy}
								disabled={!newName.trim()}
							>
								Create
							</Button>
						</div>
					)}

					<ul className={styles.list}>
						{groups.map((group) => {
							const count =
								membersByGroup.get(group.id)?.length ?? 0;
							return (
								<li key={group.id}>
									<button
										className={[
											styles.groupRow,
											group.id === selectedId
												? styles.groupRowActive
												: "",
										]
											.filter(Boolean)
											.join(" ")}
										onClick={() =>
											setParams({ group: group.id })
										}
									>
										<span className={styles.groupMain}>
											<Text
												variant="bodyStrong"
												as="span"
												clamp={1}
											>
												{group.name}
											</Text>
											<Text
												variant="caption"
												tone="tertiary"
												as="span"
											>
												{count} member
												{count === 1 ? "" : "s"}
											</Text>
										</span>
										{group.joinCode && (
											<Icon
												name="key-outline"
												size="sm"
												className={styles.keyIcon}
											/>
										)}
									</button>
								</li>
							);
						})}
					</ul>

					{!isLoading && groups.length === 0 && (
						<EmptyState
							icon="albums-outline"
							title="No groups yet"
							description="Create one to target events at a subset of your staff."
							action={
								<Button
									variant="secondary"
									icon="add"
									onClick={() => setCreating(true)}
								>
									New group
								</Button>
							}
						/>
					)}
				</Card>

				{selected ? (
					<GroupDetail
						key={selected.id}
						group={selected}
						members={membersByGroup.get(selected.id) ?? []}
						allMembers={members}
						canDelete={isOwner}
						onDeleted={() => setParams({})}
					/>
				) : (
					<Card className={styles.detailPane}>
						<EmptyState
							icon="albums-outline"
							title="Select a group"
							description="Pick one on the left to see its members, join code and published events."
						/>
					</Card>
				)}
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ detail */

function GroupDetail({
	group,
	members,
	allMembers,
	canDelete,
	onDeleted,
}: {
	group: Group;
	members: Membership[];
	allMembers: Membership[];
	canDelete: boolean;
	onDeleted: () => void;
}) {
	const { companyId } = useCompany();
	const toast = useToast();

	const [name, setName] = useState(group.name);
	const [busy, setBusy] = useState<string | null>(null);
	const [adding, setAdding] = useState(false);

	const nonMembers = allMembers.filter(
		(m) => m.role === Role.USER && !(m.groupIds ?? []).includes(group.id),
	);

	async function run(key: string, work: () => Promise<void>, ok: string) {
		setBusy(key);
		try {
			await work();
			toast.success(ok);
		} catch (error) {
			toast.error(
				"That did not work",
				error instanceof Error ? error.message : undefined,
			);
		} finally {
			setBusy(null);
		}
	}

	async function copyCode() {
		if (!group.joinCode) return;
		try {
			await navigator.clipboard.writeText(group.joinCode);
			toast.success("Join code copied");
		} catch {
			toast.warning(
				"Could not copy",
				"Select the code and copy it manually.",
			);
		}
	}

	return (
		<Card flush className={styles.detailPane}>
			<div className={styles.detailHead}>
				<Input
					value={name}
					onChange={(e) => setName(e.target.value)}
					onBlur={() => {
						if (name.trim() && name.trim() !== group.name) {
							void run(
								"rename",
								() => renameGroup(group.id, name.trim()),
								"Renamed",
							);
						} else {
							setName(group.name);
						}
					}}
					className={styles.nameInput}
					aria-label="Group name"
				/>
				{canDelete && (
					<Button
						variant="ghost"
						size="small"
						icon="trash-outline"
						busy={busy === "delete"}
						onClick={() =>
							/*
							 * Reused from the app — the react-native Alert it
							 * raises is rendered by AlertHost as a real dialog.
							 */
							showConfirmation(
								`Delete ${group.name}?`,
								`${members.length} member${
									members.length === 1 ? "" : "s"
								} will be unassigned from it. Events already published to this group keep their audience.`,
								() => {
									void run(
										"delete",
										async () => {
											await deleteGroup(
												companyId,
												group.id,
											);
											onDeleted();
										},
										"Group deleted",
									);
								},
								"Delete",
								"destructive",
							)
						}
					>
						Delete
					</Button>
				)}
			</div>

			<div className={styles.detailBody}>
				{/* ------------------------------------------- join code */}
				<section className={styles.section}>
					<Text variant="overline" tone="tertiary">
						Join code
					</Text>

					{group.joinCode ? (
						<>
							<button
								className={styles.code}
								onClick={copyCode}
								title="Copy"
							>
								<span className={styles.codeValue}>
									{group.joinCode}
								</span>
								<Icon name="copy-outline" size="sm" />
							</button>

							<Text variant="caption" tone="secondary">
								Someone joining with this code lands in{" "}
								{group.name} as{" "}
								<strong>{group.joinVisibility}</strong> —{" "}
								{group.joinVisibility === "restricted"
									? "they will only see jobs they are invited to."
									: "they will see every job that is not targeted at a specific group."}
							</Text>

							<div className={styles.codeActions}>
								<Button
									variant="secondary"
									size="small"
									icon="refresh"
									busy={busy === "rotate"}
									onClick={() =>
										void run(
											"rotate",
											async () => {
												await setGroupJoinCode(
													companyId,
													group.id,
													group.joinVisibility,
													group.joinCode,
												);
											},
											"New code issued — the old one no longer works",
										)
									}
								>
									Rotate
								</Button>
								<Button
									variant="ghost"
									size="small"
									busy={busy === "clear"}
									onClick={() =>
										void run(
											"clear",
											() =>
												clearGroupJoinCode(
													group.id,
													group.joinCode as string,
												),
											"Join code removed",
										)
									}
								>
									Remove code
								</Button>
							</div>
						</>
					) : (
						<>
							<Text variant="caption" tone="secondary">
								No join code. Issue one so staff can join
								straight into this group.
							</Text>
							<div className={styles.codeActions}>
								{(
									["open", "restricted"] as WorkerVisibility[]
								).map((visibility) => (
									<Button
										key={visibility}
										variant={
											visibility === "open"
												? "secondary"
												: "outline"
										}
										size="small"
										icon="key-outline"
										busy={busy === visibility}
										onClick={() =>
											void run(
												visibility,
												async () => {
													await setGroupJoinCode(
														companyId,
														group.id,
														visibility,
													);
												},
												`Issued a ${visibility} join code`,
											)
										}
									>
										Issue {visibility} code
									</Button>
								))}
							</div>
						</>
					)}
				</section>

				{/* --------------------------------------------- members */}
				<section className={styles.section}>
					<div className={styles.sectionHead}>
						<Text variant="overline" tone="tertiary">
							Members ({members.length})
						</Text>
						{nonMembers.length > 0 && (
							<Button
								variant="ghost"
								size="small"
								icon="add"
								onClick={() => setAdding((v) => !v)}
							>
								Add
							</Button>
						)}
					</div>

					{adding && (
						<ul className={styles.addList}>
							{nonMembers.map((member) => (
								<li key={member.id}>
									<button
										className={styles.addRow}
										onClick={() =>
											void run(
												`add-${member.userId}`,
												() =>
													setMemberGroups(
														companyId,
														member.userId,
														[
															...(member.groupIds ??
																[]),
															group.id,
														],
													),
												`Added ${member.firstName}`,
											)
										}
									>
										<Icon name="add" size="sm" />
										<Text variant="body" as="span">
											{member.firstName} {member.lastName}
										</Text>
									</button>
								</li>
							))}
						</ul>
					)}

					{members.length === 0 ? (
						<Text variant="caption" tone="tertiary">
							Nobody is in this group yet.
						</Text>
					) : (
						<ul className={styles.memberList}>
							{members.map((member) => (
								<li
									key={member.id}
									className={styles.memberRow}
								>
									<span className={styles.memberMain}>
										<Text
											variant="body"
											as="span"
											clamp={1}
										>
											{member.firstName} {member.lastName}
										</Text>
										<Badge
											tone={
												member.visibility ===
												"restricted"
													? "neutral"
													: "success"
											}
										>
											{member.visibility ?? "open"}
										</Badge>
									</span>
									<button
										className={styles.removeButton}
										aria-label={`Remove ${member.firstName} from ${group.name}`}
										disabled={
											busy === `remove-${member.userId}`
										}
										onClick={() =>
											void run(
												`remove-${member.userId}`,
												() =>
													setMemberGroups(
														companyId,
														member.userId,
														(
															member.groupIds ??
															[]
														).filter(
															(id) =>
																id !== group.id,
														),
													),
												`Removed ${member.firstName}`,
											)
										}
									>
										<Icon name="close" size="sm" />
									</button>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>
		</Card>
	);
}
