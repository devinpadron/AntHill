import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCompany } from "../contexts/CompanyContext";
import { Icon, Text } from "../ui";
import styles from "./CompanySwitcher.module.css";

/*
 * Which company the portal is looking at.
 *
 * Switching is a NAVIGATION, not a state change — the company id lives in the
 * URL, so changing it means going to /{otherId}/calendar. CompanyGuard then
 * re-runs the membership check for the new company, which is exactly what
 * should happen: an owner of A may be a plain member of B.
 *
 * Collapses to the company initial when the sidebar is collapsed.
 */
export function CompanySwitcher({ collapsed }: { collapsed: boolean }) {
	const { adminMemberships } = useAuth();
	const { companyId, company } = useCompany();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);

	const name = company?.name ?? companyId;
	const hasChoice = adminMemberships.length > 1;

	if (collapsed) {
		return (
			<div className={styles.collapsed} title={name}>
				<span className={styles.mark}>
					{name.slice(0, 1).toUpperCase()}
				</span>
			</div>
		);
	}

	return (
		<div className={styles.wrap}>
			<button
				className={styles.trigger}
				onClick={() => hasChoice && setOpen((v) => !v)}
				disabled={!hasChoice}
				aria-expanded={hasChoice ? open : undefined}
				aria-haspopup={hasChoice ? "listbox" : undefined}
			>
				<span className={styles.mark}>
					{name.slice(0, 1).toUpperCase()}
				</span>
				<span className={styles.label}>
					<Text variant="bodyStrong" clamp={1} as="span">
						{name}
					</Text>
					<Text variant="caption" tone="tertiary" as="span">
						{adminMemberships.find((m) => m.companyId === companyId)
							?.role ?? ""}
					</Text>
				</span>
				{hasChoice && (
					<Icon
						name={open ? "chevron-up" : "chevron-down"}
						size="sm"
						className={styles.chevron}
					/>
				)}
			</button>

			{open && hasChoice && (
				<ul className={styles.menu} role="listbox">
					{adminMemberships.map((membership) => (
						<li key={membership.companyId}>
							<button
								role="option"
								aria-selected={
									membership.companyId === companyId
								}
								className={[
									styles.option,
									membership.companyId === companyId
										? styles.optionActive
										: "",
								]
									.filter(Boolean)
									.join(" ")}
								onClick={() => {
									setOpen(false);
									navigate(
										`/${membership.companyId}/calendar`,
									);
								}}
							>
								<Text variant="body" clamp={1} as="span">
									{membership.companyId}
								</Text>
								<Text
									variant="caption"
									tone="tertiary"
									as="span"
								>
									{membership.role}
								</Text>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
