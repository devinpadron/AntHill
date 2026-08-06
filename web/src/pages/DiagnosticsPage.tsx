import { useState } from "react";
import auth from "@react-native-firebase/auth";
import {
	DATABASE_ID,
	DATABASE_LABEL,
	IS_PRODUCTION_DB,
} from "@app/constants/database";
import { SUPPORTED_SCHEMA_VERSIONS } from "@app/constants/schema";
import { useAuth } from "../contexts/AuthContext";
import { useCompany } from "../contexts/CompanyContext";
import {
	BUILD_STAMP,
	canRunConformance,
	runShimConformance,
	type ConformanceResult,
} from "../lib/shimConformance";
import { Badge, Button, Card, Icon, Text } from "../ui";
import styles from "./DiagnosticsPage.module.css";

/*
 * The portal's equivalent of src/screens/dev/DiagnosticsScreen.tsx, plus the
 * shim conformance harness.
 *
 * Conformance lives HERE rather than in a script because the thing worth
 * testing is the deployed bundle talking to the real database through the real
 * rules as the real signed-in user. A Node harness would test none of that.
 */
export function DiagnosticsPage() {
	const { userId, user, adminMemberships } = useAuth();
	const { companyId, company, preferences, membership, role, isOwner } =
		useCompany();

	const [results, setResults] = useState<ConformanceResult[] | null>(null);
	const [running, setRunning] = useState(false);

	async function run() {
		setRunning(true);
		try {
			setResults(await runShimConformance(companyId));
		} finally {
			setRunning(false);
		}
	}

	const failed = results?.filter((r) => !r.ok).length ?? 0;
	const passed = (results?.length ?? 0) - failed;

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<Text variant="display" as="h1">
					Diagnostics
				</Text>
				<Badge
					tone={IS_PRODUCTION_DB ? "danger" : "warning"}
					variant={IS_PRODUCTION_DB ? "solid" : "subtle"}
				>
					{DATABASE_LABEL}
				</Badge>
				{/*
				 * The build this page came from. If it does not change after a
				 * reload, the browser is serving a cached module and any test
				 * result below describes OLD code.
				 */}
				<Badge
					tone="neutral"
					title="Build stamp — changes on every rebuild"
				>
					build {BUILD_STAMP}
				</Badge>
			</header>

			<div className={styles.grid}>
				<Card title="Connection">
					<Facts
						rows={[
							["Database", DATABASE_ID],
							["Project", import.meta.env.VITE_FB_PROJECT_ID],
							[
								"Schema versions",
								SUPPORTED_SCHEMA_VERSIONS.join(", "),
							],
							["Portal build", import.meta.env.MODE],
						]}
					/>
				</Card>

				<Card title="Signed in">
					<Facts
						rows={[
							[
								"Name",
								user
									? `${user.firstName} ${user.lastName}`.trim()
									: "—",
							],
							["Email", user?.email ?? "—"],
							["User ID", userId],
							[
								"Verified",
								auth().currentUser?.emailVerified
									? "yes"
									: "no",
							],
							[
								"Admin of",
								`${adminMemberships.length} compan${
									adminMemberships.length === 1 ? "y" : "ies"
								}`,
							],
						]}
					/>
				</Card>

				<Card title="This company">
					<Facts
						rows={[
							["Name", company?.name ?? "—"],
							["Company ID", companyId],
							["Time zone", company?.timeZone ?? "—"],
							[
								"Your role",
								`${role}${isOwner ? " (owner)" : ""}`,
							],
							["Membership ID", membership.id],
							[
								"Job access",
								`${membership.visibility} · ${
									membership.groupIds?.length ?? 0
								} group(s)`,
							],
						]}
					/>
				</Card>

				<Card title="Feature flags">
					<Facts
						rows={[
							[
								"Timesheets",
								preferences.enableTimeSheet ? "on" : "off",
							],
							[
								"Availability",
								preferences.enableAvailability ? "on" : "off",
							],
							[
								"User event editing",
								preferences.allowUserEventEditing
									? "on"
									: "off",
							],
							[
								"Workers see labels",
								preferences.canViewEventLabels ? "on" : "off",
							],
							["Week starts", preferences.workWeekStarts],
							[
								"Event form",
								preferences.eventFormSchemaId ?? "none",
							],
							[
								"Time entry form",
								preferences.timeEntryFormSchemaId ?? "none",
							],
						]}
					/>
				</Card>
			</div>

			<Card
				title="Firestore adapter conformance"
				actions={
					<Button
						variant="primary"
						size="small"
						onClick={run}
						busy={running}
						disabled={!canRunConformance()}
					>
						Run
					</Button>
				}
			>
				<Text variant="body" tone="secondary">
					Exercises every call shape the shared service layer uses
					against this database. If these pass, all 14 services in{" "}
					<code>src/services</code> work in the browser.
				</Text>

				{!canRunConformance() && (
					<Text variant="caption" tone="warning">
						Disabled against the production database — the test
						writes and deletes documents.
					</Text>
				)}

				{results && (
					<>
						<div className={styles.summary}>
							<Badge
								tone={failed ? "danger" : "success"}
								variant="solid"
							>
								{passed}/{results.length} passed
							</Badge>
							{failed > 0 && (
								<Text variant="bodyStrong" tone="danger">
									{failed} failed
								</Text>
							)}
						</div>

						<table className={styles.table}>
							<tbody>
								{results.map((result) => (
									<tr
										key={result.name}
										className={
											result.ok ? "" : styles.rowFailed
										}
									>
										<td className={styles.status}>
											<Icon
												name={
													result.ok
														? "checkmark-circle"
														: "close-circle"
												}
												size="sm"
												color={
													result.ok
														? "var(--c-success)"
														: "var(--c-danger)"
												}
											/>
										</td>
										<td className={styles.name}>
											{result.name}
										</td>
										<td className={styles.detail}>
											{result.detail}
										</td>
										<td className={styles.ms}>
											{Math.round(result.ms)}ms
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</>
				)}
			</Card>
		</div>
	);
}

function Facts({ rows }: { rows: [string, string][] }) {
	return (
		<dl className={styles.facts}>
			{rows.map(([label, value]) => (
				<div key={label} className={styles.fact}>
					<Text variant="caption" tone="tertiary" as="dt">
						{label}
					</Text>
					<Text variant="body" as="dd" mono clamp={1} title={value}>
						{value}
					</Text>
				</div>
			))}
		</dl>
	);
}
