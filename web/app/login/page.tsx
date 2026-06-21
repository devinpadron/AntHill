"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
	const router = useRouter();
	const { session } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (session) router.replace("/employees");
	}, [session, router]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		setBusy(false);
		if (error) setError(error.message);
		else router.replace("/employees");
	}

	return (
		<main
			style={{
				minHeight: "100vh",
				display: "grid",
				placeItems: "center",
				padding: 24,
			}}
		>
			<div
				className="card"
				style={{ width: 380, padding: 32, borderRadius: 24 }}
			>
				<div
					style={{
						width: 48,
						height: 48,
						borderRadius: 14,
						background: "var(--ink-900)",
						color: "var(--cream-50)",
						display: "grid",
						placeItems: "center",
						fontFamily: "var(--font-serif)",
						fontSize: 24,
					}}
				>
					a
				</div>
				<h1
					style={{
						fontFamily: "var(--font-serif)",
						fontSize: 34,
						margin: "20px 0 4px",
						fontWeight: 400,
					}}
				>
					Console sign-in
				</h1>
				<p
					style={{
						color: "var(--text-secondary)",
						margin: "0 0 24px",
						fontSize: 14,
					}}
				>
					Manage schedules, payroll, and your team.
				</p>

				<form
					onSubmit={handleSubmit}
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 12,
					}}
				>
					<Field
						label="Email"
						type="email"
						value={email}
						onChange={setEmail}
						placeholder="you@company.com"
					/>
					<Field
						label="Password"
						type="password"
						value={password}
						onChange={setPassword}
						placeholder="••••••••"
					/>
					{error && (
						<div style={{ color: "var(--rust-500)", fontSize: 13 }}>
							{error}
						</div>
					)}
					<button
						className="btn btn--primary"
						style={{ height: 46, marginTop: 8 }}
						disabled={busy}
						type="submit"
					>
						{busy ? "Signing in…" : "Sign in"}
					</button>
				</form>
			</div>
		</main>
	);
}

function Field({
	label,
	type,
	value,
	onChange,
	placeholder,
}: {
	label: string;
	type: string;
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
}) {
	return (
		<label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			<span className="eyebrow" style={{ marginLeft: 4 }}>
				{label}
			</span>
			<input
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				style={{
					height: 44,
					borderRadius: 12,
					border: "1px solid var(--border)",
					padding: "0 14px",
					fontSize: 15,
					background: "var(--surface-2)",
				}}
			/>
		</label>
	);
}
