"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import {
	fmtDate,
	fmtHours,
	fmtTimeRange,
	hoursFromSeconds,
	STATUS_PILL,
} from "@/lib/format";

type Profile = { name: string; email: string; role: string };
type Entry = {
	id: string;
	clock_in_at: string;
	clock_out_at: string | null;
	duration_seconds: number | null;
	status: string;
};
type Shift = { title: string; event_date: string; status: string };

export default function EmployeeDetailPage() {
	const { company } = useAuth();
	const params = useParams<{ id: string }>();
	const userId = params.id;
	const [profile, setProfile] = useState<Profile | null>(null);
	const [entries, setEntries] = useState<Entry[]>([]);
	const [shifts, setShifts] = useState<Shift[]>([]);

	const load = useCallback(async () => {
		if (!company || !userId) return;
		const [{ data: user }, { data: member }, { data: te }, { data: ew }] =
			await Promise.all([
				supabase
					.from("users")
					.select("first_name, last_name, email")
					.eq("id", userId)
					.maybeSingle(),
				supabase
					.from("company_members")
					.select("role")
					.eq("company_id", company.companyId)
					.eq("user_id", userId)
					.maybeSingle(),
				supabase
					.from("time_entries")
					.select(
						"id, clock_in_at, clock_out_at, duration_seconds, status",
					)
					.eq("company_id", company.companyId)
					.eq("user_id", userId)
					.order("clock_in_at", { ascending: false }),
				supabase
					.from("event_workers")
					.select("status, events(title, event_date)")
					.eq("user_id", userId)
					.order("assigned_at", { ascending: false }),
			]);

		setProfile({
			name: `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim(),
			email: user?.email ?? "",
			role: member?.role ?? "—",
		});
		setEntries((te ?? []) as Entry[]);
		setShifts(
			(ew ?? [])
				.filter((w: any) => w.events)
				.map((w: any) => ({
					title: w.events.title,
					event_date: w.events.event_date,
					status: w.status,
				})),
		);
	}, [company, userId]);

	useEffect(() => {
		load();
	}, [load]);

	const totalHours = entries.reduce(
		(s, e) => s + hoursFromSeconds(e.duration_seconds),
		0,
	);

	return (
		<div>
			<Link
				href="/employees"
				style={{
					color: "var(--text-secondary)",
					fontSize: 13,
					fontWeight: 600,
				}}
			>
				← Employees
			</Link>

			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 14,
					margin: "12px 0 24px",
				}}
			>
				<h1
					style={{
						fontFamily: "var(--font-serif)",
						fontSize: 34,
						fontWeight: 400,
						margin: 0,
					}}
				>
					{profile?.name ?? "—"}
				</h1>
				{profile && (
					<span
						className={`pill ${
							{
								owner: "pill--olive",
								manager: "pill--info",
								employee: "pill--neutral",
							}[profile.role] ?? "pill--neutral"
						}`}
					>
						{profile.role}
					</span>
				)}
			</div>

			{/* Stats */}
			<div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
				<Stat label="Email" value={profile?.email ?? "—"} />
				<Stat
					label="Total hours"
					value={`${totalHours.toFixed(1)} h`}
				/>
				<Stat label="Time entries" value={String(entries.length)} />
				<Stat label="Assigned shifts" value={String(shifts.length)} />
			</div>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: 24,
				}}
			>
				{/* Time entries */}
				<section>
					<div className="eyebrow" style={{ marginBottom: 10 }}>
						Time entries
					</div>
					<div className="card" style={{ overflow: "hidden" }}>
						{entries.length === 0 && (
							<Row muted>No time entries.</Row>
						)}
						{entries.map((e) => {
							const pill = STATUS_PILL[e.status] ?? {
								cls: "pill--neutral",
								label: e.status,
							};
							return (
								<Row key={e.id}>
									<div>
										<div style={{ fontWeight: 600 }}>
											{fmtDate(e.clock_in_at)}
										</div>
										<div
											style={{
												fontFamily: "var(--font-mono)",
												fontSize: 12,
												color: "var(--text-tertiary)",
											}}
										>
											{fmtTimeRange(
												e.clock_in_at,
												e.clock_out_at,
											)}
										</div>
									</div>
									<div
										style={{
											marginLeft: "auto",
											display: "flex",
											alignItems: "center",
											gap: 10,
										}}
									>
										<span
											style={{
												fontFamily: "var(--font-mono)",
												fontSize: 13,
											}}
										>
											{fmtHours(e.duration_seconds)}
										</span>
										<span className={`pill ${pill.cls}`}>
											{pill.label}
										</span>
									</div>
								</Row>
							);
						})}
					</div>
				</section>

				{/* Shifts */}
				<section>
					<div className="eyebrow" style={{ marginBottom: 10 }}>
						Assigned shifts
					</div>
					<div className="card" style={{ overflow: "hidden" }}>
						{shifts.length === 0 && <Row muted>No shifts.</Row>}
						{shifts.map((s, i) => {
							const dot =
								{
									confirmed: "var(--olive-500)",
									pending: "var(--amber-600)",
									declined: "var(--rust-500)",
								}[s.status] ?? "var(--ink-400)";
							return (
								<Row key={i}>
									<span
										style={{
											width: 8,
											height: 8,
											borderRadius: "50%",
											background: dot,
											marginRight: 10,
										}}
									/>
									<div>
										<div style={{ fontWeight: 600 }}>
											{s.title}
										</div>
										<div
											style={{
												fontSize: 12,
												color: "var(--text-tertiary)",
											}}
										>
											{fmtDate(s.event_date)}
										</div>
									</div>
								</Row>
							);
						})}
					</div>
				</section>
			</div>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="card" style={{ padding: "14px 18px", flex: 1 }}>
			<div className="eyebrow" style={{ marginBottom: 4 }}>
				{label}
			</div>
			<div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
		</div>
	);
}

function Row({
	children,
	muted,
}: {
	children: React.ReactNode;
	muted?: boolean;
}) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				padding: "13px 16px",
				borderTop: "1px solid var(--line-soft)",
				fontSize: 14,
				color: muted ? "var(--text-tertiary)" : "var(--text)",
			}}
		>
			{children}
		</div>
	);
}
