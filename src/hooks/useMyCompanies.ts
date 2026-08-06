import { useCallback, useEffect, useState } from "react";
import { useUser } from "../contexts/UserContext";
import { getMembershipsForUser } from "../services/membershipService";
import { getCompaniesByIds } from "../services/companyService";
import { setActiveCompany } from "../services/userService";
import { Role } from "../types/enums/Role";

/**
 * Every company this user belongs to, and the ability to switch between them.
 *
 * v1 read `user.companies[]` — an array kept in sync with the membership
 * documents by two non-atomic writes, which is the orphan class the audit
 * found. Memberships are the only source here.
 *
 * The membership carries the id but not the company NAME, so the names come
 * from one batched company query rather than a read per membership.
 */

export type CompanyOption = {
	companyId: string;
	name: string;
	role: Role;
};

export const useMyCompanies = () => {
	const { userId, companyId: activeCompanyId } = useUser();
	const [companies, setCompanies] = useState<CompanyOption[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (!userId) {
			setCompanies([]);
			setIsLoading(false);
			return;
		}

		let cancelled = false;
		setIsLoading(true);

		(async () => {
			const memberships = await getMembershipsForUser(userId);
			const docs = await getCompaniesByIds(
				memberships.map((m) => m.companyId),
			);

			if (cancelled) return;

			const nameById = new Map(docs.map((c) => [c.id, c.name]));

			setCompanies(
				memberships
					.map((m) => ({
						companyId: m.companyId,
						/*
						 * The id is a last resort. A company the rules let you
						 * hold a membership in but not read would otherwise
						 * render as a blank row.
						 */
						name: nameById.get(m.companyId) ?? m.companyId,
						role: m.role,
					}))
					.sort((a, b) => a.name.localeCompare(b.name)),
			);
			setIsLoading(false);
		})();

		return () => {
			cancelled = true;
		};
		/*
		 * Re-runs when the active company changes as well as the user, so a
		 * company just joined shows up without a relaunch.
		 */
	}, [userId, activeCompanyId]);

	const switchTo = useCallback(
		async (nextCompanyId: string) => {
			if (!userId || nextCompanyId === activeCompanyId) return;

			/*
			 * Only the pointer is written. UserContext is subscribed to the
			 * user document, so CompanyContext, the tabs and every screen
			 * follow on their own — there is nothing to navigate.
			 */
			await setActiveCompany(userId, nextCompanyId);
		},
		[userId, activeCompanyId],
	);

	return {
		companies,
		activeCompanyId,
		isLoading,
		/** Whether a switcher is worth showing at all. */
		hasMultiple: companies.length > 1,
		switchTo,
	};
};
