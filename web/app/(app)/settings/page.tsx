"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

type Settings = {
	work_week_starts: string;
	enable_timesheet: boolean;
	enable_availability: boolean;
	can_view_event_labels: boolean;
	allow_user_event_editing: boolean;
};
type Label = { id: string; name: string; color: string };

const TOGGLES: { key: keyof Settings; label: string; note: string }[] = [
	{
		key: "enable_timesheet",
		label: "Timesheet",
		note: "Employees can clock in/out and submit hours.",
	},
	{
		key: "enable_availability",
		label: "Availability",
		note: "Employees confirm/decline upcoming shifts.",
	},
	{
		key: "can_view_event_labels",
		label: "Event labels",
		note: "Show label colors/names to employees.",
	},
	{
		key: "allow_user_event_editing",
		label: "Employee event editing",
		note: "Let employees edit event details.",
	},
];

export default function SettingsPage() {
	const { company } = useAuth();
	const [accessCode, setAccessCode] = useState("");
	const [settings, setSettings] = useState<Settings | null>(null);
	const [labels, setLabels] = useState<Label[]>([]);
	const [newLabel, setNewLabel] = useState("");
	const [newColor, setNewColor] = useState("#6B8E23");

	const load = useCallback(async () => {
		if (!company) return;
		const [{ data: comp }, { data: cs }, { data: lbls }] =
			await Promise.all([
				supabase
					.from("companies")
					.select("access_code")
					.eq("id", company.companyId)
					.maybeSingle(),
				supabase
					.from("company_settings")
					.select(
						"work_week_starts, enable_timesheet, enable_availability, can_view_event_labels, allow_user_event_editing",
					)
					.eq("company_id", company.companyId)
					.maybeSingle(),
				supabase
					.from("event_labels")
					.select("id, name, color")
					.eq("company_id", company.companyId)
					.order("name"),
			]);
		setAccessCode(comp?.access_code ?? "");
		setSettings(cs as Settings);
		setLabels((lbls ?? []) as Label[]);
	}, [company]);

	useEffect(() => {
		load();
	}, [load]);

	async function patch(p: Partial<Settings>) {
		if (!company || !settings) return;
		setSettings({ ...settings, ...p }); // optimistic
		const { error } = await supabase
			.from("company_settings")
			.update(p)
			.eq("company_id", company.companyId);
		if (error) {
			alert(error.message);
			load();
		}
	}

	async function addLabel() {
		if (!company || !newLabel.trim()) return;
		const { error } = await supabase.from("event_labels").insert({
			company_id: company.companyId,
			name: newLabel.trim(),
			color: newColor,
		});
		if (error) alert(error.message);
		else {
			setNewLabel("");
			load();
		}
	}

	async function removeLabel(id: string) {
		await supabase.from("event_labels").delete().eq("id", id);
		load();
	}

	return (
		<div>
			<div style={{ marginBottom: 24 }}>
				<div className="eyebrow">Company</div>
				<h1
					style={{
						fontFamily: "var(--font-serif)",
						fontSize: 34,
						fontWeight: 400,
						margin: "4px 0 0",
					}}
				>
					{company?.companyName ?? "Company settings"}
				</h1>
			</div>

			<div style={{ display: "grid", gap: 20, maxWidth: 640 }}>
				{/* Access code */}
				<div className="card" style={{ padding: 20 }}>
					<div className="eyebrow">Invite code</div>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							marginTop: 8,
						}}
					>
						<code
							style={{
								fontFamily: "var(--font-mono)",
								fontSize: 18,
								letterSpacing: "0.05em",
							}}
						>
							{accessCode || "—"}
						</code>
						<button
							className="btn"
							onClick={() =>
								navigator.clipboard?.writeText(accessCode)
							}
						>
							Copy
						</button>
					</div>
				</div>

				{/* Work week + toggles */}
				<div className="card" style={{ padding: 4 }}>
					<Row
						label="Work week starts"
						note="Used for weekly totals."
					>
						<div style={{ display: "flex", gap: 4 }}>
							{(["sunday", "monday"] as const).map((d) => (
								<button
									key={d}
									className="btn"
									onClick={() =>
										patch({ work_week_starts: d })
									}
									style={{
										height: 32,
										textTransform: "capitalize",
										background:
											settings?.work_week_starts === d
												? "var(--ink-900)"
												: "var(--surface)",
										color:
											settings?.work_week_starts === d
												? "var(--cream-50)"
												: "var(--text-secondary)",
										borderColor:
											settings?.work_week_starts === d
												? "var(--ink-900)"
												: "var(--border)",
									}}
								>
									{d}
								</button>
							))}
						</div>
					</Row>
					{TOGGLES.map((t) => (
						<Row key={t.key} label={t.label} note={t.note} divider>
							<Switch
								on={!!settings?.[t.key]}
								onClick={() =>
									patch({
										[t.key]: !settings?.[t.key],
									} as any)
								}
							/>
						</Row>
					))}
				</div>

				{/* Labels */}
				<div className="card" style={{ padding: 20 }}>
					<div className="eyebrow" style={{ marginBottom: 12 }}>
						Event labels
					</div>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 8,
						}}
					>
						{labels.map((l) => (
							<div
								key={l.id}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 10,
								}}
							>
								<span
									style={{
										width: 14,
										height: 14,
										borderRadius: 4,
										background: l.color,
									}}
								/>
								<span style={{ flex: 1, fontSize: 14 }}>
									{l.name}
								</span>
								<button
									className="btn"
									style={{ height: 30, padding: "0 12px" }}
									onClick={() => removeLabel(l.id)}
								>
									Remove
								</button>
							</div>
						))}
						{labels.length === 0 && (
							<span
								style={{
									color: "var(--text-tertiary)",
									fontSize: 14,
								}}
							>
								No labels yet.
							</span>
						)}
					</div>
					<div
						style={{
							display: "flex",
							gap: 8,
							marginTop: 14,
							alignItems: "center",
						}}
					>
						<input
							type="color"
							value={newColor}
							onChange={(e) => setNewColor(e.target.value)}
							style={{
								width: 38,
								height: 38,
								border: "1px solid var(--border)",
								borderRadius: 8,
								background: "none",
							}}
						/>
						<input
							value={newLabel}
							onChange={(e) => setNewLabel(e.target.value)}
							placeholder="New label name"
							style={{
								flex: 1,
								height: 38,
								borderRadius: 10,
								border: "1px solid var(--border)",
								padding: "0 12px",
								fontSize: 14,
								background: "var(--surface-2)",
							}}
						/>
						<button
							className="btn btn--accent"
							onClick={addLabel}
							disabled={!newLabel.trim()}
						>
							Add
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function Row({
	label,
	note,
	children,
	divider,
}: {
	label: string;
	note: string;
	children: React.ReactNode;
	divider?: boolean;
}) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 16,
				padding: "16px",
				borderTop: divider ? "1px solid var(--line-soft)" : "none",
			}}
		>
			<div>
				<div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
				<div
					style={{
						fontSize: 13,
						color: "var(--text-tertiary)",
						marginTop: 2,
					}}
				>
					{note}
				</div>
			</div>
			{children}
		</div>
	);
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
	return (
		<button
			onClick={onClick}
			aria-pressed={on}
			style={{
				width: 44,
				height: 26,
				borderRadius: 999,
				border: "none",
				background: on ? "var(--olive-500)" : "var(--line)",
				position: "relative",
				transition: "background 0.15s",
				flexShrink: 0,
			}}
		>
			<span
				style={{
					position: "absolute",
					top: 3,
					left: on ? 21 : 3,
					width: 20,
					height: 20,
					borderRadius: "50%",
					background: "#fff",
					transition: "left 0.15s",
					boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
				}}
			/>
		</button>
	);
}
