import { NavLink } from "react-router-dom";
import { useCompany } from "../contexts/CompanyContext";
import { Icon, Text, type IconName } from "../ui";
import { CompanySwitcher } from "./CompanySwitcher";
import { UserMenu } from "./UserMenu";
import styles from "./SideNav.module.css";

/*
 * Primary navigation.
 *
 * Two entries are FEATURE-FLAGGED by company preferences, exactly as the app's
 * HomeTabs gates its Availability and Clock tabs. Preferences are a live
 * subscription, so an admin turning `enableTimeSheet` on makes Payroll appear
 * here without a reload — same behavior as the phone.
 *
 * Groups is gated on enableAvailability too: worker groups exist to target
 * event audiences, which is the availability feature. The app makes the same
 * call in Settings.tsx.
 */

type NavItem = {
	to: string;
	label: string;
	icon: IconName;
	iconActive: IconName;
	/** Matches nested routes, e.g. /calendar/events/:id. */
	end?: boolean;
};

export function SideNav({
	collapsed,
	onToggle,
}: {
	collapsed: boolean;
	onToggle: () => void;
}) {
	const { companyId, preferences } = useCompany();
	const base = `/${companyId}`;

	const items: NavItem[] = [
		{
			to: `${base}/calendar`,
			label: "Calendar",
			icon: "calendar-outline",
			iconActive: "calendar",
		},
		...(preferences.enableAvailability
			? [
					{
						to: `${base}/availability`,
						label: "Availability",
						icon: "grid-outline" as IconName,
						iconActive: "grid-outline" as IconName,
					},
				]
			: []),
		...(preferences.enableTimeSheet
			? [
					{
						to: `${base}/payroll`,
						label: "Payroll",
						icon: "time-outline" as IconName,
						iconActive: "time" as IconName,
					},
				]
			: []),
		{
			to: `${base}/employees`,
			label: "People",
			icon: "people-outline",
			iconActive: "people",
		},
		...(preferences.enableAvailability
			? [
					{
						to: `${base}/groups`,
						label: "Groups",
						icon: "albums-outline" as IconName,
						iconActive: "albums-outline" as IconName,
					},
				]
			: []),
		{
			to: `${base}/settings`,
			label: "Settings",
			icon: "settings-outline",
			iconActive: "settings",
		},
	];

	return (
		<nav
			className={styles.nav}
			aria-label="Main"
			data-collapsed={collapsed || undefined}
		>
			<CompanySwitcher collapsed={collapsed} />

			<ul className={styles.list}>
				{items.map((item) => (
					<li key={item.to}>
						<NavLink
							to={item.to}
							className={({ isActive }) =>
								[styles.link, isActive ? styles.active : ""]
									.filter(Boolean)
									.join(" ")
							}
							title={collapsed ? item.label : undefined}
						>
							{({ isActive }) => (
								<>
									<Icon
										name={
											isActive
												? item.iconActive
												: item.icon
										}
										size="md"
										label={
											collapsed ? item.label : undefined
										}
									/>
									{!collapsed && (
										<Text
											variant="bodyStrong"
											as="span"
											tone={
												isActive
													? "accent"
													: "secondary"
											}
										>
											{item.label}
										</Text>
									)}
								</>
							)}
						</NavLink>
					</li>
				))}
			</ul>

			<div className={styles.footer}>
				<UserMenu collapsed={collapsed} />
				<button
					className={styles.collapseToggle}
					onClick={onToggle}
					aria-label={
						collapsed ? "Expand sidebar" : "Collapse sidebar"
					}
					title={collapsed ? "Expand" : "Collapse"}
				>
					<Icon
						name={collapsed ? "chevron-forward" : "chevron-back"}
						size="sm"
					/>
				</button>
			</div>
		</nav>
	);
}
