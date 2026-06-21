"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

type Row = {
	id: string;
	name: string;
	email: string;
	role: string;
	periodHours: number;
	pending: number;
	active: boolean;
};

const ROLE_PILL: Record<string, string> = {
	owner: "pill--olive",
	manager: "pill--info",
	employee: "pill--neutral",
};

export default function EmployeesPage() {
	const { company } = useAuth();
	const [rows, setRows] = useState<Row[] | null>(null);

	useEffect(() => {
		if (!company) return;
		(async () => {
			const [{ data: members }, { data: entries }] = await Promise.all([
				supabase
					.from("company_members")
					.select("role, users(id, first_name, last_name, email)")
					.eq("company_id", company.companyId),
				supabase
					.from("time_entries")
					.select("user_id, duration_seconds, status")
					.eq("company_id", company.companyId),
			]);

			const hours = new Map<string, number>();
			const pending = new Map<string, number>();
			const active = new Set<string>();
			for (const e of entries ?? []) {
				hours.set(
					e.user_id,
					(hours.get(e.user_id) ?? 0) + (e.duration_seconds ?? 0),
				);
				if (e.status === "pending_approval")
					pending.set(e.user_id, (pending.get(e.user_id) ?? 0) + 1);
				if (e.status === "active") active.add(e.user_id);
			}

			const list: Row[] = (members ?? [])
				.map((m: any) => {
					const u = m.users;
					return {
						id: u.id,
						name: `${u.first_name} ${u.last_name}`.trim(),
						email: u.email,
						role: m.role,
						periodHours: (hours.get(u.id) ?? 0) / 3600,
						pending: pending.get(u.id) ?? 0,
						active: active.has(u.id),
					};
				})
				.sort((a, b) => a.name.localeCompare(b.name));
			setRows(list);
		})();
	}, [company]);

	return (
		<div>
			<div style={{ marginBottom: 24 }}>
				<div className="eyebrow">Team</div>
				<h1
					style={{
						fontFamily: "var(--font-serif)",
						fontSize: 34,
						fontWeight: 400,
						margin: "4px 0 0",
					}}
				>
					Employees
				</h1>
			</div>

			<div className="card" style={{ overflow: "hidden" }}>
				<table style={{ width: "100%", borderCollapse: "collapse" }}>
					<thead>
						<tr style={{ background: "var(--surface-2)" }}>
							<Th>Name</Th>
							<Th>Role</Th>
							<Th>Email</Th>
							<Th align="right">Hours (all time)</Th>
							<Th align="right">Status</Th>
						</tr>
					</thead>
					<tbody>
						{rows === null && (
							<tr>
								<Td colSpan={5} muted>
									Loading…
								</Td>
							</tr>
						)}
						{rows?.length === 0 && (
							<tr>
								<Td colSpan={5} muted>
									No employees yet.
								</Td>
							</tr>
						)}
						{rows?.map((r) => (
							<tr
								key={r.id}
								style={{
									borderTop: "1px solid var(--line-soft)",
								}}
							>
								<Td>
									<strong>{r.name}</strong>
								</Td>
								<Td>
									<span
										className={`pill ${ROLE_PILL[r.role] ?? "pill--neutral"}`}
									>
										{r.role}
									</span>
								</Td>
								<Td muted>{r.email}</Td>
								<Td align="right" mono>
									{r.periodHours.toFixed(1)} h
								</Td>
								<Td align="right">
									{r.active ? (
										<span className="pill pill--olive">
											On the clock
										</span>
									) : r.pending > 0 ? (
										<span className="pill pill--amber">
											{r.pending} pending
										</span>
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
						))}
					</tbody>
				</table>
			</div>
		</div>
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
	colSpan,
}: {
	children: React.ReactNode;
	align?: "left" | "right";
	muted?: boolean;
	mono?: boolean;
	colSpan?: number;
}) {
	return (
		<td
			colSpan={colSpan}
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
