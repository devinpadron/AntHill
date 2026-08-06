import { useMemo, useState } from "react";
import { useCompanyMembers } from "@app/hooks/useCompanyMembers";
import { useGroups } from "@app/hooks/useGroups";
import { showMemberActions } from "@app/utils/memberActions";
import { Role } from "@app/types/enums/Role";
import type { Membership } from "@app/types";
import { useCompany } from "../../contexts/CompanyContext";
import {
	Badge,
	Button,
	Card,
	DataTable,
	EmptyState,
	Icon,
	Input,
	Select,
	Text,
	type Column,
} from "../../ui";
import { JobAccessDrawer } from "./JobAccessDrawer";
import { InvitePanel } from "./InvitePanel";
import styles from "./EmployeesPage.module.css";

/*
 * The company roster.
 *
 * `useCompanyMembers` and `useGroups` are imported VERBATIM from the app —
 * both take only services and React, so the portal and the phone read the
 * roster through the same code and sort it the same way (owner, manager, then
 * user; then last name).
 *
 * `showMemberActions` is likewise reused unchanged. It is the owner-only
 * promote / demote / remove gate, and it raises a react-native Alert that the
 * shim routes into AlertHost as a real dialog. Reimplementing it here would
 * mean a permission check maintained in two places, which is exactly one too
 * many.
 *
 * What the desktop adds over the phone's list: role, job access, groups, join
 * source and last-seen are all visible AT ONCE rather than behind a tap, and
 * every column sorts. The app has to hide promote/demote behind a long-press;
 * here it is a visible row action.
 */

type RoleFilter = "all" | Role;
type AccessFilter = "all" | "open" | "restricted";

export function EmployeesPage() {
	const { companyId, role: currentUserRole, isOwner } = useCompany();
	const { members, isLoading } = useCompanyMembers(companyId);
	const { groups, namesFor } = useGroups(companyId);

	const [query, setQuery] = useState("");
	const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
	const [groupFilter, setGroupFilter] = useState("all");
	const [accessFilter, setAccessFilter] = useState<AccessFilter>("all");
	const [selected, setSelected] = useState<Membership | null>(null);

	/*
	 * Wrapped rather than passing `setSelected` straight to onRowClick: a
	 * setter also accepts an updater function, so handing it in directly makes
	 * TypeScript infer the table's row type as SetStateAction<Membership>.
	 */
	const openMember = (member: Membership) => setSelected(member);

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return members.filter((member) => {
			if (roleFilter !== "all" && member.role !== roleFilter)
				return false;
			if (
				accessFilter !== "all" &&
				(member.visibility ?? "open") !== accessFilter
			) {
				return false;
			}
			if (
				groupFilter !== "all" &&
				!(member.groupIds ?? []).includes(groupFilter)
			) {
				return false;
			}
			if (!needle) return true;
			return [
				member.firstName,
				member.lastName,
				member.email,
				member.phone,
			]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(needle));
		});
	}, [members, query, roleFilter, groupFilter, accessFilter]);

	const counts = useMemo(
		() => ({
			owners: members.filter((m) => m.role === Role.OWNER).length,
			managers: members.filter((m) => m.role === Role.MANAGER).length,
			workers: members.filter((m) => m.role === Role.USER).length,
			restricted: members.filter((m) => m.visibility === "restricted")
				.length,
		}),
		[members],
	);

	const columns: Column<Membership>[] = [
		{
			id: "name",
			header: "Name",
			// Sorted by last name, matching the service's orderBy("lastName").
			sortValue: (m) => `${m.lastName} ${m.firstName}`,
			width: "220px",
			render: (m) => (
				<span className={styles.nameCell}>
					<Text variant="bodyStrong" as="span" clamp={1}>
						{m.lastName}, {m.firstName}
					</Text>
				</span>
			),
		},
		{
			id: "role",
			header: "Role",
			sortValue: (m) => m.role,
			width: "110px",
			render: (m) => (
				<Badge
					tone={
						m.role === Role.OWNER
							? "accent"
							: m.role === Role.MANAGER
								? "info"
								: "neutral"
					}
				>
					{m.role}
				</Badge>
			),
		},
		{
			id: "email",
			header: "Email",
			sortValue: (m) => m.email,
			render: (m) =>
				m.email ? (
					<a
						href={`mailto:${m.email}`}
						onClick={(e) => e.stopPropagation()}
						className={styles.link}
					>
						{m.email}
					</a>
				) : (
					<Muted />
				),
		},
		{
			id: "phone",
			header: "Phone",
			sortValue: (m) => m.phone ?? "",
			width: "140px",
			render: (m) =>
				m.phone ? (
					<a
						href={`tel:${m.phone}`}
						onClick={(e) => e.stopPropagation()}
						className={styles.link}
					>
						{m.phone}
					</a>
				) : (
					<Muted />
				),
		},
		{
			id: "access",
			header: "Job access",
			title: "Open workers see untargeted jobs; restricted workers only see invitations",
			sortValue: (m) => m.visibility ?? "open",
			width: "120px",
			render: (m) => {
				const visibility = m.visibility ?? "open";
				const restricted = visibility === "restricted";
				// The app warns about this combination too: a restricted worker
				// with no groups can be invited to nothing.
				const stranded = restricted && !(m.groupIds ?? []).length;
				return (
					<Badge
						tone={
							stranded
								? "warning"
								: restricted
									? "neutral"
									: "success"
						}
						icon={stranded ? "warning" : undefined}
						title={
							stranded
								? "Restricted, but in no groups — this worker can see no jobs at all"
								: undefined
						}
					>
						{visibility}
					</Badge>
				);
			},
		},
		{
			id: "groups",
			header: "Groups",
			sortValue: (m) => (m.groupIds ?? []).length,
			render: (m) => {
				const ids = m.groupIds ?? [];
				if (!ids.length) return <Muted />;
				const names = namesFor(ids);
				return (
					<span className={styles.chips} title={names.join(", ")}>
						{ids.slice(0, 2).map((id, index) => (
							<Badge key={id} tone="accent">
								{names[index] ?? id}
							</Badge>
						))}
						{ids.length > 2 && (
							<Badge tone="neutral">+{ids.length - 2}</Badge>
						)}
					</span>
				);
			},
		},
		{
			id: "joined",
			header: "Joined",
			sortValue: (m) => m.joinedAt?.toMillis?.() ?? 0,
			width: "110px",
			render: (m) =>
				m.joinedAt ? (
					<span>{m.joinedAt.toDate().toLocaleDateString()}</span>
				) : (
					<Muted />
				),
		},
		{
			id: "joinedVia",
			header: "Joined via",
			optional: true,
			sortValue: (m) => m.joinedViaCode ?? "",
			width: "110px",
			render: (m) =>
				m.joinedViaCode ? (
					<Text variant="caption" as="span" mono>
						{m.joinedViaCode}
					</Text>
				) : (
					<Muted />
				),
		},
		{
			id: "actions",
			header: "",
			width: "44px",
			align: "right",
			render: (m) => {
				// Exactly memberActions' own gate: owner-only, and never
				// against another owner. Rendering the control when it would
				// silently no-op is worse than not rendering it — the app has
				// that bug, and a manager gets no feedback at all.
				const permitted = isOwner && m.role !== Role.OWNER;
				if (!permitted) return null;
				return (
					<button
						className={styles.rowAction}
						aria-label={`Actions for ${m.firstName} ${m.lastName}`}
						onClick={(event) => {
							event.stopPropagation();
							showMemberActions(
								m,
								currentUserRole,
								companyId,
								() => {},
							);
						}}
					>
						<Icon name="ellipsis-horizontal" size="sm" />
					</button>
				);
			},
		},
	];

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div>
					<Text variant="display" as="h1">
						People
					</Text>
					<Text variant="caption" tone="secondary">
						{counts.owners} owner{counts.owners === 1 ? "" : "s"} ·{" "}
						{counts.managers} manager
						{counts.managers === 1 ? "" : "s"} · {counts.workers}{" "}
						worker{counts.workers === 1 ? "" : "s"}
						{counts.restricted > 0 &&
							` · ${counts.restricted} restricted`}
					</Text>
				</div>
				<InvitePanel />
			</header>

			<div className={styles.filters}>
				<Input
					icon="search"
					placeholder="Search name, email or phone"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className={styles.search}
				/>
				<Select
					value={roleFilter}
					onChange={(e) =>
						setRoleFilter(e.target.value as RoleFilter)
					}
					aria-label="Filter by role"
				>
					<option value="all">All roles</option>
					<option value={Role.OWNER}>Owners</option>
					<option value={Role.MANAGER}>Managers</option>
					<option value={Role.USER}>Workers</option>
				</Select>
				<Select
					value={accessFilter}
					onChange={(e) =>
						setAccessFilter(e.target.value as AccessFilter)
					}
					aria-label="Filter by job access"
				>
					<option value="all">All access</option>
					<option value="open">Open</option>
					<option value="restricted">Restricted</option>
				</Select>
				{groups.length > 0 && (
					<Select
						value={groupFilter}
						onChange={(e) => setGroupFilter(e.target.value)}
						aria-label="Filter by group"
					>
						<option value="all">All groups</option>
						{groups.map((group) => (
							<option key={group.id} value={group.id}>
								{group.name}
							</option>
						))}
					</Select>
				)}
				{filtered.length !== members.length && (
					<Button
						variant="ghost"
						size="small"
						onClick={() => {
							setQuery("");
							setRoleFilter("all");
							setGroupFilter("all");
							setAccessFilter("all");
						}}
					>
						Clear ({filtered.length}/{members.length})
					</Button>
				)}
			</div>

			<Card flush className={styles.tableCard}>
				<DataTable
					rows={filtered}
					columns={columns}
					rowKey={(m) => m.id}
					isLoading={isLoading}
					storageKey="employees"
					onRowClick={openMember}
					selectedKey={selected?.id ?? null}
					empty={
						<EmptyState
							icon="people-outline"
							title={
								members.length
									? "No one matches those filters"
									: "No members yet"
							}
							description={
								members.length
									? undefined
									: "Share the company access code so staff can join from the app."
							}
						/>
					}
				/>
			</Card>

			{selected && (
				<JobAccessDrawer
					member={selected}
					onClose={() => setSelected(null)}
				/>
			)}
		</div>
	);
}

const Muted = () => (
	<Text variant="caption" tone="tertiary" as="span">
		—
	</Text>
);
