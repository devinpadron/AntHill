import { NavLink, Outlet } from "react-router-dom";
import { useCompany } from "../../contexts/CompanyContext";
import { Icon, Text, type IconName } from "../../ui";
import styles from "./SettingsLayout.module.css";

/*
 * Settings, with a persistent sub-nav.
 *
 * The app reaches these through a list of rows in a stack, so moving between
 * checklists and packages means going back and forward. Here they are siblings.
 *
 * The two form editors are listed separately rather than behind one "Forms"
 * entry: they are different forms with different audiences, and an admin
 * looking for the timesheet questions should not have to know they share an
 * editor.
 */

type Item = { to: string; label: string; icon: IconName; hint: string };

export function SettingsLayout() {
	const { companyId, preferences } = useCompany();
	const base = `/${companyId}/settings`;

	const items: Item[] = [
		{
			to: base,
			label: "Company",
			icon: "business-outline",
			hint: "Name, time zone, access code, features",
		},
		...(preferences.enableTimeSheet
			? [
					{
						to: `${base}/forms/timeEntryForm`,
						label: "Timesheet form",
						icon: "document-text-outline" as IconName,
						hint: "What workers fill in when clocking out",
					},
				]
			: []),
		{
			to: `${base}/forms/eventForm`,
			label: "Event form",
			icon: "document-outline",
			hint: "Per-event questions on a time entry",
		},
		{
			to: `${base}/checklists`,
			label: "Checklists",
			icon: "list",
			hint: "Reusable task lists",
		},
		{
			to: `${base}/packages`,
			label: "Packages",
			icon: "albums-outline",
			hint: "Bundles of checklists",
		},
		{
			to: `${base}/labels`,
			label: "Event labels",
			icon: "pricetag-outline",
			hint: "Colour-coding for the calendar",
		},
	];

	return (
		<div className={styles.layout}>
			<nav className={styles.nav} aria-label="Settings">
				<Text
					variant="overline"
					tone="tertiary"
					className={styles.navHead}
				>
					Settings
				</Text>
				<ul>
					{items.map((item) => (
						<li key={item.to}>
							<NavLink
								to={item.to}
								end={item.to === base}
								className={({ isActive }) =>
									[styles.link, isActive ? styles.active : ""]
										.filter(Boolean)
										.join(" ")
								}
							>
								<Icon name={item.icon} size="sm" />
								<span className={styles.linkText}>
									<Text variant="body" as="span">
										{item.label}
									</Text>
									<Text
										variant="caption"
										tone="tertiary"
										as="span"
									>
										{item.hint}
									</Text>
								</span>
							</NavLink>
						</li>
					))}
				</ul>
			</nav>

			<div className={styles.content}>
				<Outlet />
			</div>
		</div>
	);
}
