import { useState } from "react";
import { useGroups } from "@app/hooks/useGroups";
import { useCompany } from "../../contexts/CompanyContext";
import { Badge, Button, Icon, Text, useToast } from "../../ui";
import styles from "./InvitePanel.module.css";

/*
 * How someone joins this company: the company-wide access code, plus any group
 * join codes.
 *
 * The app scatters these — the access code is in Company preferences, group
 * codes are in Worker groups. An admin onboarding a new hire wants both in one
 * place, so the portal collects them behind one button.
 *
 * Codes are shown, not sent. Emailing an invite would need a Cloud Function,
 * and that repo is out of scope here.
 */
export function InvitePanel() {
	const { companyId, company } = useCompany();
	const { groups } = useGroups(companyId);
	const toast = useToast();
	const [open, setOpen] = useState(false);

	async function copy(value: string, label: string) {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(`${label} copied`);
		} catch {
			// Clipboard is blocked outside a secure context; the code is on
			// screen either way, so this is a nudge rather than a failure.
			toast.warning(
				"Could not copy",
				"Select the code and copy it manually.",
			);
		}
	}

	const withCodes = groups.filter((group) => group.joinCode);

	return (
		<div className={styles.wrap}>
			<Button
				variant="secondary"
				icon="person-outline"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
			>
				Invite
			</Button>

			{open && (
				<>
					<div
						className={styles.backdrop}
						onClick={() => setOpen(false)}
					/>
					<div className={styles.panel}>
						<Text variant="overline" tone="tertiary">
							Company access code
						</Text>
						<Text variant="caption" tone="secondary">
							Anyone with this code can join{" "}
							{company?.name ?? "this company"} as a worker.
						</Text>

						<button
							className={styles.code}
							onClick={() =>
								copy(company?.accessCode ?? "", "Access code")
							}
							title="Copy"
						>
							<span className={styles.codeValue}>
								{company?.accessCode ?? "…"}
							</span>
							<Icon name="copy-outline" size="sm" />
						</button>

						{withCodes.length > 0 && (
							<>
								<Text variant="overline" tone="tertiary">
									Group join codes
								</Text>
								<Text variant="caption" tone="secondary">
									Joining with one of these also puts the
									person in that group.
								</Text>
								<ul className={styles.groupCodes}>
									{withCodes.map((group) => (
										<li key={group.id}>
											<button
												className={styles.code}
												onClick={() =>
													copy(
														group.joinCode ?? "",
														`${group.name} code`,
													)
												}
												title="Copy"
											>
												<span
													className={styles.groupName}
												>
													<Text
														variant="body"
														as="span"
														clamp={1}
													>
														{group.name}
													</Text>
													<Badge
														tone={
															group.joinVisibility ===
															"restricted"
																? "neutral"
																: "success"
														}
													>
														{group.joinVisibility}
													</Badge>
												</span>
												<span
													className={
														styles.codeValueSmall
													}
												>
													{group.joinCode}
												</span>
												<Icon
													name="copy-outline"
													size="sm"
												/>
											</button>
										</li>
									))}
								</ul>
							</>
						)}
					</div>
				</>
			)}
		</div>
	);
}
