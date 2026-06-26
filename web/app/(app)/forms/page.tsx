"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

type FieldType = "text" | "multiline" | "number" | "dropdown" | "checkbox";
type Field = {
	id: string;
	type: FieldType;
	label: string;
	placeholder?: string;
	required: boolean;
	options?: string[];
};
type FormSchema = {
	isEnabled: boolean;
	title: string;
	description: string;
	fields: Field[];
};

type Which = "time_entry_form" | "event_form";

const FIELD_TYPES: { type: FieldType; label: string }[] = [
	{ type: "text", label: "Text" },
	{ type: "multiline", label: "Paragraph" },
	{ type: "number", label: "Number" },
	{ type: "dropdown", label: "Dropdown" },
	{ type: "checkbox", label: "Checkbox" },
];

const emptyForm = (): FormSchema => ({
	isEnabled: false,
	title: "",
	description: "",
	fields: [],
});

export default function FormsPage() {
	const { company } = useAuth();
	const [which, setWhich] = useState<Which>("time_entry_form");
	const [forms, setForms] = useState<Record<Which, FormSchema> | null>(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	const load = useCallback(async () => {
		if (!company) return;
		const { data } = await supabase
			.from("company_settings")
			.select("time_entry_form, event_form")
			.eq("company_id", company.companyId)
			.maybeSingle();
		setForms({
			time_entry_form: {
				...emptyForm(),
				...(data?.time_entry_form ?? {}),
			},
			event_form: { ...emptyForm(), ...(data?.event_form ?? {}) },
		});
	}, [company]);

	useEffect(() => {
		load();
	}, [load]);

	const form = forms?.[which];
	const setForm = (next: FormSchema) => {
		setForms((prev) => (prev ? { ...prev, [which]: next } : prev));
		setSaved(false);
	};

	function addField(type: FieldType) {
		if (!form) return;
		const field: Field = {
			id: `field_${Date.now()}`,
			type,
			label: "Untitled question",
			required: false,
			...(type === "dropdown" ? { options: ["Option 1"] } : {}),
		};
		setForm({ ...form, fields: [...form.fields, field] });
	}

	function updateField(id: string, patch: Partial<Field>) {
		if (!form) return;
		setForm({
			...form,
			fields: form.fields.map((f) =>
				f.id === id ? { ...f, ...patch } : f,
			),
		});
	}

	function move(id: string, dir: -1 | 1) {
		if (!form) return;
		const i = form.fields.findIndex((f) => f.id === id);
		const j = i + dir;
		if (i < 0 || j < 0 || j >= form.fields.length) return;
		const fields = [...form.fields];
		[fields[i], fields[j]] = [fields[j], fields[i]];
		setForm({ ...form, fields });
	}

	function removeField(id: string) {
		if (!form) return;
		setForm({ ...form, fields: form.fields.filter((f) => f.id !== id) });
	}

	async function save() {
		if (!company || !forms) return;
		setSaving(true);
		const { error } = await supabase
			.from("company_settings")
			.update({ [which]: forms[which] })
			.eq("company_id", company.companyId);
		setSaving(false);
		if (error) alert(error.message);
		else setSaved(true);
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
					<div className="eyebrow">Custom forms</div>
					<h1
						style={{
							fontFamily: "var(--font-serif)",
							fontSize: 34,
							fontWeight: 400,
							margin: "4px 0 0",
						}}
					>
						Form builder
					</h1>
				</div>
				<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
					{saved && (
						<span
							style={{ color: "var(--olive-600)", fontSize: 13 }}
						>
							Saved ✓
						</span>
					)}
					<button
						className="btn btn--accent"
						onClick={save}
						disabled={saving || !form}
					>
						{saving ? "Saving…" : "Save form"}
					</button>
				</div>
			</div>

			{/* Which form */}
			<div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
				<Seg
					active={which === "time_entry_form"}
					onClick={() => setWhich("time_entry_form")}
				>
					Time entry submission
				</Seg>
				<Seg
					active={which === "event_form"}
					onClick={() => setWhich("event_form")}
				>
					Event form
				</Seg>
			</div>

			{!form ? (
				<p style={{ color: "var(--text-secondary)" }}>Loading…</p>
			) : (
				<div style={{ maxWidth: 680 }}>
					{/* Form meta */}
					<div
						className="card"
						style={{ padding: 20, marginBottom: 20 }}
					>
						<label
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								marginBottom: 14,
							}}
						>
							<input
								type="checkbox"
								checked={form.isEnabled}
								onChange={(e) =>
									setForm({
										...form,
										isEnabled: e.target.checked,
									})
								}
							/>
							<span style={{ fontWeight: 600 }}>
								Enabled — shown to employees
							</span>
						</label>
						<input
							className="fb-input"
							placeholder="Form title"
							value={form.title}
							onChange={(e) =>
								setForm({ ...form, title: e.target.value })
							}
							style={{ marginBottom: 10 }}
						/>
						<input
							className="fb-input"
							placeholder="Description (optional)"
							value={form.description}
							onChange={(e) =>
								setForm({
									...form,
									description: e.target.value,
								})
							}
						/>
					</div>

					{/* Fields */}
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 12,
						}}
					>
						{form.fields.map((f, i) => (
							<FieldCard
								key={f.id}
								field={f}
								first={i === 0}
								last={i === form.fields.length - 1}
								onChange={(p) => updateField(f.id, p)}
								onMove={(d) => move(f.id, d)}
								onRemove={() => removeField(f.id)}
							/>
						))}
						{form.fields.length === 0 && (
							<div
								className="card"
								style={{
									padding: 28,
									textAlign: "center",
									color: "var(--text-secondary)",
								}}
							>
								No fields yet. Add one below.
							</div>
						)}
					</div>

					{/* Add field */}
					<div
						style={{
							display: "flex",
							gap: 8,
							marginTop: 16,
							flexWrap: "wrap",
						}}
					>
						{FIELD_TYPES.map((t) => (
							<button
								key={t.type}
								className="btn"
								onClick={() => addField(t.type)}
							>
								+ {t.label}
							</button>
						))}
					</div>
				</div>
			)}

			<style jsx>{`
				:global(.fb-input) {
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
			`}</style>
		</div>
	);
}

function FieldCard({
	field,
	first,
	last,
	onChange,
	onMove,
	onRemove,
}: {
	field: Field;
	first: boolean;
	last: boolean;
	onChange: (p: Partial<Field>) => void;
	onMove: (d: -1 | 1) => void;
	onRemove: () => void;
}) {
	return (
		<div className="card" style={{ padding: 16 }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 10,
					marginBottom: 10,
				}}
			>
				<span className="pill pill--neutral">{field.type}</span>
				<div style={{ flex: 1 }} />
				<IconBtn disabled={first} onClick={() => onMove(-1)}>
					↑
				</IconBtn>
				<IconBtn disabled={last} onClick={() => onMove(1)}>
					↓
				</IconBtn>
				<IconBtn onClick={onRemove}>×</IconBtn>
			</div>

			<input
				className="fb-input"
				value={field.label}
				onChange={(e) => onChange({ label: e.target.value })}
				placeholder="Question label"
				style={{ marginBottom: 10 }}
			/>

			{field.type === "dropdown" && (
				<input
					className="fb-input"
					value={(field.options ?? []).join(", ")}
					onChange={(e) =>
						onChange({
							options: e.target.value
								.split(",")
								.map((s) => s.trim())
								.filter(Boolean),
						})
					}
					placeholder="Options, comma-separated"
					style={{ marginBottom: 10 }}
				/>
			)}
			{(field.type === "text" ||
				field.type === "multiline" ||
				field.type === "number") && (
				<input
					className="fb-input"
					value={field.placeholder ?? ""}
					onChange={(e) => onChange({ placeholder: e.target.value })}
					placeholder="Placeholder (optional)"
					style={{ marginBottom: 10 }}
				/>
			)}

			<label
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					fontSize: 13,
					color: "var(--text-secondary)",
				}}
			>
				<input
					type="checkbox"
					checked={field.required}
					onChange={(e) => onChange({ required: e.target.checked })}
				/>
				Required
			</label>
		</div>
	);
}

function IconBtn({
	children,
	onClick,
	disabled,
}: {
	children: React.ReactNode;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			style={{
				width: 28,
				height: 28,
				borderRadius: 8,
				border: "1px solid var(--border)",
				background: "var(--surface)",
				color: "var(--text-secondary)",
				opacity: disabled ? 0.4 : 1,
				fontSize: 15,
				lineHeight: 1,
			}}
		>
			{children}
		</button>
	);
}

function Seg({
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
				background: active ? "var(--ink-900)" : "var(--surface)",
				color: active ? "var(--cream-50)" : "var(--text-secondary)",
				borderColor: active ? "var(--ink-900)" : "var(--border)",
			}}
		>
			{children}
		</button>
	);
}
