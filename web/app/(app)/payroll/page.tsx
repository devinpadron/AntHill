"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import {
	fmtDate,
	fmtHours,
	fmtTimeRange,
	hoursFromSeconds,
	STATUS_PILL,
} from "@/lib/format";

type Entry = {
	id: string;
	user_id: string;
	name: string;
	clock_in_at: string;
	clock_out_at: string | null;
	duration_seconds: number | null;
	status: string;
};

type Filter = "pending_approval" | "all";

export default function PayrollPage() {
	const { company, session } = useAuth();
	const [entries, setEntries] = useState<Entry[] | null>(null);
	const [filter, setFilter] = useState<Filter>("pending_approval");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		if (!company) return;
		let q = supabase
			.from("time_entries")
			.select(
				"id, user_id, clock_in_at, clock_out_at, duration_seconds, status, users(first_name, last_name)",
			)
			.eq("company_id", company.companyId)
			.order("clock_in_at", { ascending: false });
		if (filter === "pending_approval")
			q = q.eq("status", "pending_approval");

		const { data } = await q;
		setEntries(
			(data ?? []).map((e: any) => ({
				id: e.id,
				user_id: e.user_id,
				name: `${e.users?.first_name ?? ""} ${e.users?.last_name ?? ""}`.trim(),
				clock_in_at: e.clock_in_at,
				clock_out_at: e.clock_out_at,
				duration_seconds: e.duration_seconds,
				status: e.status,
			})),
		);
		setSelected(new Set());
	}, [company, filter]);

	useEffect(() => {
		load();
	}, [load]);

	const toggle = (id: string) =>
		setSelected((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});

	const allSelected =
		!!entries && entries.length > 0 && selected.size === entries.length;
	const toggleAll = () =>
		setSelected(
			allSelected ? new Set() : new Set((entries ?? []).map((e) => e.id)),
		);

	const selectedHours = useMemo(() => {
		const byId = new Map((entries ?? []).map((e) => [e.id, e]));
		let s = 0;
		for (const id of selected)
			s += hoursFromSeconds(byId.get(id)?.duration_seconds);
		return s;
	}, [selected, entries]);

	async function act(ids: string[], approve: boolean) {
		if (ids.length === 0 || !session) return;
		setBusy(true);
		const patch = approve
			? {
					status: "approved",
					approved_by: session.user.id,
					approved_at: new Date().toISOString(),
				}
			: {
					status: "rejected",
					rejected_by: session.user.id,
					rejected_at: new Date().toISOString(),
				};
		const { error } = await supabase
			.from("time_entries")
			.update(patch)
			.in("id", ids);
		setBusy(false);
		if (error) alert(error.message);
		else await load();
	}

	return (
		<div>
			<div
				style={{
					display: "flex",
					alignItems: "flex-end",
					justifyContent: "space-between",
					marginBottom: 24,
				}}
			>
				<div>
					<div className="eyebrow">Payroll</div>
					<h1
						style={{
							fontFamily: "var(--font-serif)",
							fontSize: 34,
							fontWeight: 400,
							margin: "4px 0 0",
						}}
					>
						Payroll review
					</h1>
				</div>
				<div style={{ display: "flex", gap: 4 }}>
					<Segment
						active={filter === "pending_approval"}
						onClick={() => setFilter("pending_approval")}
					>
						Pending
					</Segment>
					<Segment
						active={filter === "all"}
						onClick={() => setFilter("all")}
					>
						All
					</Segment>
				</div>
			</div>

			{/* Bulk action bar */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 12,
					marginBottom: 12,
					minHeight: 38,
				}}
			>
				<span style={{ color: "var(--text-secondary)", fontSize: 14 }}>
					{selected.size > 0
						? `${selected.size} selected · ${selectedHours.toFixed(1)} h`
						: `${entries?.length ?? 0} entr${entries?.length === 1 ? "y" : "ies"}`}
				</span>
				<div style={{ flex: 1 }} />
				<button
					className="btn btn--accent"
					disabled={busy || selected.size === 0}
					onClick={() => act([...selected], true)}
				>
					Approve selected
				</button>
				<button
					className="btn"
					disabled={busy || selected.size === 0}
					onClick={() => act([...selected], false)}
				>
					Deny selected
				</button>
			</div>

			<div className="card" style={{ overflow: "hidden" }}>
				<table style={{ width: "100%", borderCollapse: "collapse" }}>
					<thead>
						<tr style={{ background: "var(--surface-2)" }}>
							<th
								style={{
									width: 44,
									padding: "12px 0 12px 18px",
								}}
							>
								<input
									type="checkbox"
									checked={allSelected}
									onChange={toggleAll}
								/>
							</th>
							<Th>Employee</Th>
							<Th>Date</Th>
							<Th>Shift</Th>
							<Th align="right">Hours</Th>
							<Th align="right">Status</Th>
							<Th align="right">Actions</Th>
						</tr>
					</thead>
					<tbody>
						{entries === null && <Empty>Loading…</Empty>}
						{entries?.length === 0 && (
							<Empty>
								{filter === "pending_approval"
									? "Nothing pending. "
									: "No time entries."}
							</Empty>
						)}
						{entries?.map((e) => {
							const pill = STATUS_PILL[e.status] ?? {
								cls: "pill--neutral",
								label: e.status,
							};
							return (
								<tr
									key={e.id}
									style={{
										borderTop: "1px solid var(--line-soft)",
										background: selected.has(e.id)
											? "var(--accent-soft)"
											: undefined,
									}}
								>
									<td style={{ padding: "14px 0 14px 18px" }}>
										<input
											type="checkbox"
											checked={selected.has(e.id)}
											onChange={() => toggle(e.id)}
										/>
									</td>
									<Td>
										<strong>{e.name}</strong>
									</Td>
									<Td muted>{fmtDate(e.clock_in_at)}</Td>
									<Td muted mono>
										{fmtTimeRange(
											e.clock_in_at,
											e.clock_out_at,
										)}
									</Td>
									<Td align="right" mono>
										{fmtHours(e.duration_seconds)}
									</Td>
									<Td align="right">
										<span className={`pill ${pill.cls}`}>
											{pill.label}
										</span>
									</Td>
									<Td align="right">
										{e.status === "pending_approval" ? (
											<div
												style={{
													display: "inline-flex",
													gap: 6,
												}}
											>
												<button
													className="btn btn--accent"
													style={{
														height: 30,
														padding: "0 12px",
													}}
													disabled={busy}
													onClick={() =>
														act([e.id], true)
													}
												>
													Approve
												</button>
												<button
													className="btn"
													style={{
														height: 30,
														padding: "0 12px",
													}}
													disabled={busy}
													onClick={() =>
														act([e.id], false)
													}
												>
													Deny
												</button>
											</div>
										) : (
											<span
												style={{
													color: "var(--text-tertiary)",
												}}
											>
												—
											</span>
										)}
									</Td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function Segment({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			onClick={onClick}
			className="btn"
			style={{
				height: 34,
				background: active ? "var(--ink-900)" : "var(--surface)",
				color: active ? "var(--cream-50)" : "var(--text-secondary)",
				borderColor: active ? "var(--ink-900)" : "var(--border)",
			}}
		>
			{children}
		</button>
	);
}

function Th({
	children,
	align = "left",
}: {
	children: React.ReactNode;
	align?: "left" | "right";
}) {
	return (
		<th
			style={{
				textAlign: align,
				padding: "12px 18px",
				fontSize: 11,
				letterSpacing: "0.1em",
				textTransform: "uppercase",
				color: "var(--text-tertiary)",
				fontWeight: 600,
			}}
		>
			{children}
		</th>
	);
}

function Td({
	children,
	align = "left",
	muted,
	mono,
}: {
	children: React.ReactNode;
	align?: "left" | "right";
	muted?: boolean;
	mono?: boolean;
}) {
	return (
		<td
			style={{
				textAlign: align,
				padding: "14px 18px",
				fontSize: 14,
				color: muted ? "var(--text-secondary)" : "var(--text)",
				fontFamily: mono ? "var(--font-mono)" : "inherit",
			}}
		>
			{children}
		</td>
	);
}

function Empty({ children }: { children: React.ReactNode }) {
	return (
		<tr>
			<td
				colSpan={7}
				style={{
					padding: "28px 18px",
					textAlign: "center",
					color: "var(--text-secondary)",
					fontSize: 14,
				}}
			>
				{children}
			</td>
		</tr>
	);
}
