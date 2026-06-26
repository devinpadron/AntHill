"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtTimeRange } from "@/lib/format";
import { EventEditor } from "@/components/EventEditor";

type Worker = { userId: string; name: string; status: string };
type Event = {
	id: string;
	title: string;
	eventDate: string;
	startAt: string;
	endAt: string | null;
	address: string | null;
	label: { name: string; color: string } | null;
	workers: Worker[];
};
type RosterMember = { id: string; name: string };

const STATUS_DOT: Record<string, string> = {
	confirmed: "var(--olive-500)",
	pending: "var(--amber-600)",
	declined: "var(--rust-500)",
};

export default function SchedulePage() {
	const { company } = useAuth();
	const [events, setEvents] = useState<Event[] | null>(null);
	const [roster, setRoster] = useState<RosterMember[]>([]);
	const [busy, setBusy] = useState(false);
	const [editorFor, setEditorFor] = useState<string | "new" | null>(null);
	const [dropTarget, setDropTarget] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!company) return;
		const today = new Date().toISOString().slice(0, 10);
		const [{ data: evs }, { data: members }] = await Promise.all([
			supabase
				.from("events")
				.select(
					"id, title, event_date, start_at, end_at, address, event_labels(name, color), event_workers(user_id, status, users(first_name, last_name))",
				)
				.eq("company_id", company.companyId)
				.is("deleted_at", null)
				.gte("event_date", today)
				.order("start_at", { ascending: true }),
			supabase
				.from("company_members")
				.select("user_id, role, users(first_name, last_name)")
				.eq("company_id", company.companyId),
		]);

		setEvents(
			(evs ?? []).map((e: any) => ({
				id: e.id,
				title: e.title,
				eventDate: e.event_date,
				startAt: e.start_at,
				endAt: e.end_at,
				address: e.address,
				label: e.event_labels
					? { name: e.event_labels.name, color: e.event_labels.color }
					: null,
				workers: (e.event_workers ?? []).map((w: any) => ({
					userId: w.user_id,
					name: `${w.users?.first_name ?? ""} ${w.users?.last_name ?? ""}`.trim(),
					status: w.status,
				})),
			})),
		);
		setRoster(
			(members ?? [])
				.map((m: any) => ({
					id: m.user_id,
					name: `${m.users?.first_name ?? ""} ${m.users?.last_name ?? ""}`.trim(),
				}))
				.sort((a: RosterMember, b: RosterMember) =>
					a.name.localeCompare(b.name),
				),
		);
	}, [company]);

	useEffect(() => {
		load();
	}, [load]);

	async function assign(eventId: string, userId: string) {
		if (!userId) return;
		setBusy(true);
		const { error } = await supabase
			.from("event_workers")
			.insert({ event_id: eventId, user_id: userId, status: "pending" });
		setBusy(false);
		if (error) alert(error.message);
		else await load();
	}

	async function unassign(eventId: string, userId: string) {
		setBusy(true);
		await supabase
			.from("event_workers")
			.delete()
			.eq("event_id", eventId)
			.eq("user_id", userId);
		setBusy(false);
		await load();
	}

	// Group by date.
	const groups: Record<string, Event[]> = {};
	for (const e of events ?? []) (groups[e.eventDate] ??= []).push(e);

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
					<div className="eyebrow">Scheduling</div>
					<h1
						style={{
							fontFamily: "var(--font-serif)",
							fontSize: 34,
							fontWeight: 400,
							margin: "4px 0 0",
						}}
					>
						Schedule
					</h1>
				</div>
				<button
					className="btn btn--accent"
					onClick={() => setEditorFor("new")}
				>
					+ New event
				</button>
			</div>

			{editorFor && company && (
				<EventEditor
					companyId={company.companyId}
					eventId={editorFor === "new" ? null : editorFor}
					onClose={() => setEditorFor(null)}
					onSaved={() => {
						setEditorFor(null);
						load();
					}}
				/>
			)}

			{roster.length > 0 && (
				<div
					className="card"
					style={{
						padding: 14,
						marginBottom: 20,
						display: "flex",
						alignItems: "center",
						gap: 10,
						flexWrap: "wrap",
					}}
				>
					<span className="eyebrow" style={{ marginRight: 4 }}>
						Drag to assign →
					</span>
					{roster.map((r) => (
						<span
							key={r.id}
							draggable
							onDragStart={(ev) =>
								ev.dataTransfer.setData("text/plain", r.id)
							}
							style={{
								cursor: "grab",
								padding: "6px 12px",
								borderRadius: 999,
								border: "1px solid var(--border)",
								background: "var(--surface-2)",
								fontSize: 13,
								userSelect: "none",
							}}
						>
							{r.name}
						</span>
					))}
				</div>
			)}

			{events === null && (
				<p style={{ color: "var(--text-secondary)" }}>Loading…</p>
			)}
			{events?.length === 0 && (
				<div
					className="card"
					style={{
						padding: 40,
						textAlign: "center",
						color: "var(--text-secondary)",
					}}
				>
					No upcoming events.
				</div>
			)}

			<div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
				{Object.entries(groups).map(([date, evs]) => (
					<section key={date}>
						<div className="eyebrow" style={{ marginBottom: 10 }}>
							{fmtDate(date)}
						</div>
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								gap: 12,
							}}
						>
							{evs.map((e) => {
								const assignedIds = new Set(
									e.workers.map((w) => w.userId),
								);
								const available = roster.filter(
									(r) => !assignedIds.has(r.id),
								);
								return (
									<div
										key={e.id}
										className="card"
										onDragOver={(ev) => {
											ev.preventDefault();
											if (dropTarget !== e.id)
												setDropTarget(e.id);
										}}
										onDragLeave={() =>
											setDropTarget((t) =>
												t === e.id ? null : t,
											)
										}
										onDrop={(ev) => {
											ev.preventDefault();
											setDropTarget(null);
											const uid =
												ev.dataTransfer.getData(
													"text/plain",
												);
											if (uid && !assignedIds.has(uid))
												assign(e.id, uid);
										}}
										style={{
											padding: 18,
											display: "flex",
											gap: 18,
											borderLeft: `3px solid ${e.label?.color ?? "var(--olive-500)"}`,
											outline:
												dropTarget === e.id
													? "2px solid var(--olive-500)"
													: "none",
											outlineOffset: 2,
											background:
												dropTarget === e.id
													? "var(--accent-soft)"
													: undefined,
										}}
									>
										<div style={{ minWidth: 150 }}>
											<div
												style={{
													fontFamily:
														"var(--font-mono)",
													fontSize: 13,
													color: "var(--text-secondary)",
												}}
											>
												{fmtTimeRange(
													e.startAt,
													e.endAt,
												)}
											</div>
											<div
												style={{
													fontSize: 16,
													fontWeight: 600,
													marginTop: 4,
												}}
											>
												{e.title}
											</div>
											{e.address && (
												<div
													style={{
														fontSize: 13,
														color: "var(--text-tertiary)",
														marginTop: 2,
													}}
												>
													{e.address}
												</div>
											)}
											{e.label && (
												<span
													className="pill"
													style={{
														marginTop: 8,
														background:
															"var(--surface-2)",
														color: "var(--text-secondary)",
													}}
												>
													{e.label.name}
												</span>
											)}
											<div>
												<button
													className="btn"
													style={{
														height: 28,
														padding: "0 10px",
														marginTop: 12,
														fontSize: 12,
													}}
													onClick={() =>
														setEditorFor(e.id)
													}
												>
													Edit
												</button>
											</div>
										</div>

										<div style={{ flex: 1 }}>
											<div
												className="eyebrow"
												style={{ marginBottom: 8 }}
											>
												Crew ({e.workers.length})
											</div>
											<div
												style={{
													display: "flex",
													flexWrap: "wrap",
													gap: 8,
												}}
											>
												{e.workers.map((w) => (
													<span
														key={w.userId}
														title={`${w.status}`}
														style={{
															display:
																"inline-flex",
															alignItems:
																"center",
															gap: 7,
															padding:
																"5px 10px 5px 9px",
															borderRadius: 999,
															border: "1px solid var(--border)",
															fontSize: 13,
															background:
																"var(--surface)",
														}}
													>
														<span
															style={{
																width: 7,
																height: 7,
																borderRadius:
																	"50%",
																background:
																	STATUS_DOT[
																		w.status
																	] ??
																	"var(--ink-400)",
															}}
														/>
														{w.name}
														<button
															onClick={() =>
																unassign(
																	e.id,
																	w.userId,
																)
															}
															disabled={busy}
															title="Remove"
															style={{
																border: "none",
																background:
																	"none",
																color: "var(--text-tertiary)",
																padding: 0,
																marginLeft: 2,
																fontSize: 15,
																lineHeight: 1,
															}}
														>
															×
														</button>
													</span>
												))}

												{available.length > 0 && (
													<select
														value=""
														disabled={busy}
														onChange={(ev) =>
															assign(
																e.id,
																ev.target.value,
															)
														}
														style={{
															height: 31,
															borderRadius: 999,
															border: "1px dashed var(--border)",
															background:
																"var(--surface-2)",
															color: "var(--text-secondary)",
															fontSize: 13,
															padding: "0 10px",
														}}
													>
														<option value="">
															+ assign…
														</option>
														{available.map((r) => (
															<option
																key={r.id}
																value={r.id}
															>
																{r.name}
															</option>
														))}
													</select>
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</section>
				))}
			</div>
		</div>
	);
}
