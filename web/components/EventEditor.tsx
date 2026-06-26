"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Label = { id: string; name: string; color: string };

interface Props {
	companyId: string;
	/** Pass an event id to edit; omit to create. */
	eventId?: string | null;
	onClose: () => void;
	onSaved: () => void;
}

function toLocalInputs(iso: string | null) {
	if (!iso) return { date: "", time: "" };
	const d = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, "0");
	return {
		date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
		time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
	};
}

const combine = (date: string, time: string) =>
	date && time ? new Date(`${date}T${time}`).toISOString() : null;

export function EventEditor({ companyId, eventId, onClose, onSaved }: Props) {
	const editing = !!eventId;
	const [labels, setLabels] = useState<Label[]>([]);
	const [loading, setLoading] = useState(editing);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [title, setTitle] = useState("");
	const [date, setDate] = useState("");
	const [startTime, setStartTime] = useState("");
	const [endTime, setEndTime] = useState("");
	const [address, setAddress] = useState("");
	const [labelId, setLabelId] = useState("");
	const [notes, setNotes] = useState("");

	useEffect(() => {
		supabase
			.from("event_labels")
			.select("id, name, color")
			.eq("company_id", companyId)
			.order("name")
			.then(({ data }) => setLabels((data ?? []) as Label[]));
	}, [companyId]);

	useEffect(() => {
		if (!eventId) return;
		supabase
			.from("events")
			.select(
				"title, event_date, start_at, end_at, address, label_id, notes_workers",
			)
			.eq("id", eventId)
			.maybeSingle()
			.then(({ data }) => {
				if (data) {
					setTitle(data.title ?? "");
					const s = toLocalInputs(data.start_at);
					const e = toLocalInputs(data.end_at);
					setDate(s.date || data.event_date || "");
					setStartTime(s.time);
					setEndTime(e.time);
					setAddress(data.address ?? "");
					setLabelId(data.label_id ?? "");
					setNotes(data.notes_workers ?? "");
				}
				setLoading(false);
			});
	}, [eventId]);

	async function save() {
		setError(null);
		if (!title.trim() || !date || !startTime) {
			setError("Title, date, and start time are required.");
			return;
		}
		setSaving(true);
		const payload = {
			company_id: companyId,
			title: title.trim(),
			event_date: date,
			start_at: combine(date, startTime),
			end_at: combine(date, endTime),
			address: address.trim() || null,
			label_id: labelId || null,
			notes_workers: notes.trim() || null,
		};
		const res = editing
			? await supabase.from("events").update(payload).eq("id", eventId)
			: await supabase.from("events").insert(payload);
		setSaving(false);
		if (res.error) setError(res.error.message);
		else onSaved();
	}

	return (
		<div
			onClick={onClose}
			style={{
				position: "fixed",
				inset: 0,
				background: "rgba(29,29,39,0.45)",
				display: "grid",
				placeItems: "center",
				zIndex: 50,
				padding: 24,
			}}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				className="card"
				style={{ width: 480, maxWidth: "100%", padding: 24 }}
			>
				<h2
					style={{
						fontFamily: "var(--font-serif)",
						fontSize: 26,
						fontWeight: 400,
						margin: "0 0 18px",
					}}
				>
					{editing ? "Edit event" : "New event"}
				</h2>

				{loading ? (
					<p style={{ color: "var(--text-secondary)" }}>Loading…</p>
				) : (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 12,
						}}
					>
						<Field label="Title">
							<input
								className="ee-input"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Harborview Wedding"
							/>
						</Field>
						<div style={{ display: "flex", gap: 12 }}>
							<Field label="Date" grow>
								<input
									className="ee-input"
									type="date"
									value={date}
									onChange={(e) => setDate(e.target.value)}
								/>
							</Field>
							<Field label="Start">
								<input
									className="ee-input"
									type="time"
									value={startTime}
									onChange={(e) =>
										setStartTime(e.target.value)
									}
								/>
							</Field>
							<Field label="End">
								<input
									className="ee-input"
									type="time"
									value={endTime}
									onChange={(e) => setEndTime(e.target.value)}
								/>
							</Field>
						</div>
						<Field label="Address">
							<input
								className="ee-input"
								value={address}
								onChange={(e) => setAddress(e.target.value)}
								placeholder="120 Harbor Way"
							/>
						</Field>
						<Field label="Label">
							<select
								className="ee-input"
								value={labelId}
								onChange={(e) => setLabelId(e.target.value)}
							>
								<option value="">No label</option>
								{labels.map((l) => (
									<option key={l.id} value={l.id}>
										{l.name}
									</option>
								))}
							</select>
						</Field>
						<Field label="Notes for workers">
							<textarea
								className="ee-input"
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								rows={2}
								style={{ resize: "vertical", paddingTop: 8 }}
							/>
						</Field>

						{error && (
							<div
								style={{
									color: "var(--rust-500)",
									fontSize: 13,
								}}
							>
								{error}
							</div>
						)}

						<div
							style={{
								display: "flex",
								justifyContent: "flex-end",
								gap: 8,
								marginTop: 8,
							}}
						>
							<button className="btn" onClick={onClose}>
								Cancel
							</button>
							<button
								className="btn btn--accent"
								onClick={save}
								disabled={saving}
							>
								{saving
									? "Saving…"
									: editing
										? "Save changes"
										: "Create event"}
							</button>
						</div>
					</div>
				)}

				<style jsx>{`
					.ee-input {
						width: 100%;
						height: 40px;
						border-radius: 10px;
						border: 1px solid var(--border);
						padding: 0 12px;
						font-size: 14px;
						font-family: inherit;
						background: var(--surface-2);
						color: var(--text);
					}
					textarea.ee-input {
						height: auto;
					}
				`}</style>
			</div>
		</div>
	);
}

function Field({
	label,
	children,
	grow,
}: {
	label: string;
	children: React.ReactNode;
	grow?: boolean;
}) {
	return (
		<label
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 6,
				flex: grow ? 1 : undefined,
			}}
		>
			<span className="eyebrow" style={{ marginLeft: 4 }}>
				{label}
			</span>
			{children}
		</label>
	);
}
