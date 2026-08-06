import { Link, useLocation, useParams } from "react-router-dom";
import { DATABASE_LABEL, IS_PRODUCTION_DB } from "@app/constants/database";
import { useCompany } from "../contexts/CompanyContext";
import { Badge, Icon, Text } from "../ui";
import styles from "./Topbar.module.css";

/*
 * Breadcrumb, and the database badge.
 *
 * The badge is developer furniture, so the real portal does not show it — an
 * admin doing their job has no use for the word PROD in the corner of every
 * screen.
 *
 * It stays visible in exactly two cases, both of which are someone working on
 * the portal rather than working IN it:
 *
 *   the dev server            obviously not the real thing
 *   any build on `test` data  a staging deploy is byte-identical to production
 *                             and the two databases are full copies of each
 *                             other, so with no badge NOTHING on screen says
 *                             which one you are in. Approving a week of
 *                             timesheets against the wrong copy is a silent,
 *                             wasted afternoon.
 *
 * So the live portal is clean, and the staging URL still announces itself.
 * /diagnostics always states the database outright, whatever this decides.
 */
const SHOW_DATABASE_BADGE = import.meta.env.DEV || !IS_PRODUCTION_DB;

const SEGMENT_LABELS: Record<string, string> = {
	calendar: "Calendar",
	availability: "Availability",
	payroll: "Payroll",
	employees: "People",
	groups: "Groups",
	settings: "Settings",
	events: "Events",
	entries: "Entries",
	new: "New",
	edit: "Edit",
	checklists: "Checklists",
	packages: "Packages",
	labels: "Labels",
	forms: "Forms",
	diagnostics: "Diagnostics",
};

export function Topbar() {
	const { companyId, company } = useCompany();
	const { pathname } = useLocation();
	const params = useParams();

	// Everything after /:companyId, with opaque ids dropped — a breadcrumb
	// reading "Calendar / Events / aB3xK9..." helps nobody.
	const idValues = new Set(Object.values(params).filter(Boolean));
	const crumbs = pathname
		.split("/")
		.filter(Boolean)
		.slice(1)
		.filter((segment) => !idValues.has(segment) || SEGMENT_LABELS[segment])
		.map((segment) => SEGMENT_LABELS[segment] ?? segment);

	return (
		<header className={styles.bar}>
			<nav className={styles.crumbs} aria-label="Breadcrumb">
				<Link to={`/${companyId}/calendar`} className={styles.home}>
					<Text variant="label" tone="secondary" as="span">
						{company?.name ?? companyId}
					</Text>
				</Link>
				{crumbs.map((crumb, index) => (
					<span key={`${crumb}-${index}`} className={styles.crumb}>
						<Icon
							name="chevron-forward"
							size="xs"
							className={styles.sep}
						/>
						<Text
							variant="label"
							tone={
								index === crumbs.length - 1
									? "default"
									: "secondary"
							}
							as="span"
						>
							{crumb}
						</Text>
					</span>
				))}
			</nav>

			<div className={styles.right}>
				{SHOW_DATABASE_BADGE && (
					<Badge
						tone={IS_PRODUCTION_DB ? "danger" : "warning"}
						variant={IS_PRODUCTION_DB ? "solid" : "subtle"}
						title={
							IS_PRODUCTION_DB
								? "Connected to the production database"
								: "Connected to the test database — changes here do not affect real data"
						}
					>
						{DATABASE_LABEL}
					</Badge>
				)}
			</div>
		</header>
	);
}
