"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

const NAV = [
	{ href: "/employees", label: "Employees" },
	{ href: "/payroll", label: "Payroll" },
	{ href: "/schedule", label: "Schedule" },
	{ href: "/settings", label: "Company" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const { session, loading, company } = useAuth();
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		if (!loading && !session) router.replace("/login");
	}, [loading, session, router]);

	if (loading || !session) {
		return (
			<div
				style={{
					display: "grid",
					placeItems: "center",
					height: "100vh",
				}}
			>
				<span style={{ color: "var(--text-tertiary)" }}>Loading…</span>
			</div>
		);
	}

	return (
		<div style={{ display: "flex", minHeight: "100vh" }}>
			{/* Sidebar */}
			<aside
				style={{
					width: 232,
					background: "var(--surface)",
					borderRight: "1px solid var(--border)",
					display: "flex",
					flexDirection: "column",
					padding: 16,
					position: "sticky",
					top: 0,
					height: "100vh",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						padding: "8px 8px 20px",
					}}
				>
					<div
						style={{
							width: 30,
							height: 30,
							borderRadius: 9,
							background: "var(--ink-900)",
							color: "var(--cream-50)",
							display: "grid",
							placeItems: "center",
							fontFamily: "var(--font-serif)",
							fontSize: 17,
						}}
					>
						a
					</div>
					<span
						style={{
							fontFamily: "var(--font-serif)",
							fontSize: 20,
						}}
					>
						anthill
					</span>
				</div>

				<nav
					style={{ display: "flex", flexDirection: "column", gap: 2 }}
				>
					{NAV.map((item) => {
						const active = pathname?.startsWith(item.href);
						return (
							<Link
								key={item.href}
								href={item.href}
								style={{
									padding: "10px 12px",
									borderRadius: 10,
									fontSize: 14,
									fontWeight: 600,
									color: active
										? "var(--olive-700)"
										: "var(--text-secondary)",
									background: active
										? "var(--accent-soft)"
										: "transparent",
								}}
							>
								{item.label}
							</Link>
						);
					})}
				</nav>

				<div style={{ marginTop: "auto" }}>
					<div className="eyebrow" style={{ marginBottom: 4 }}>
						{company?.role ?? "—"}
					</div>
					<div
						style={{
							fontWeight: 600,
							fontSize: 14,
							marginBottom: 12,
						}}
					>
						{company?.companyName ?? "—"}
					</div>
					<button
						className="btn"
						style={{ width: "100%", height: 34 }}
						onClick={async () => {
							await supabase.auth.signOut();
							router.replace("/login");
						}}
					>
						Sign out
					</button>
				</div>
			</aside>

			{/* Main */}
			<main style={{ flex: 1, padding: "32px 40px", maxWidth: 1100 }}>
				{children}
			</main>
		</div>
	);
}
