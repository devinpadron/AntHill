import { useState, type ReactNode } from "react";
import { SideNav } from "./SideNav";
import { Topbar } from "./Topbar";
import styles from "./AppShell.module.css";

/*
 * The portal frame: a fixed sidebar, a topbar, and a content region that owns
 * its own scrolling.
 *
 * The page body never scrolls (see styles/global.css) — panes do. That is what
 * lets the calendar keep a sticky filter rail, payroll keep a sticky bulk-action
 * bar, and the staffing board keep a frozen header row, all at once.
 */

const COLLAPSE_KEY = "PORTAL_SIDEBAR_COLLAPSED";

export function AppShell({ children }: { children: ReactNode }) {
	const [collapsed, setCollapsed] = useState(
		() => localStorage.getItem(COLLAPSE_KEY) === "1",
	);

	const toggle = () => {
		setCollapsed((current) => {
			localStorage.setItem(COLLAPSE_KEY, current ? "0" : "1");
			return !current;
		});
	};

	return (
		<div
			className={[styles.shell, collapsed ? styles.collapsed : ""]
				.filter(Boolean)
				.join(" ")}
		>
			<SideNav collapsed={collapsed} onToggle={toggle} />
			<div className={styles.main}>
				<Topbar />
				<main className={styles.content}>{children}</main>
			</div>
		</div>
	);
}
