import { useEffect, useMemo, useState } from "react";
import { subscribeMembers } from "../services/membershipService";
import { Membership } from "../types";
import { Role } from "../types";

/*
 * The company member list.
 *
 * ONE query. v1 subscribed to Companies/{c}/Users and then fanned out a
 * getUser() per member — and did it again on every snapshot, so a single
 * membership change re-fetched every profile. That pattern appeared at six
 * separate call sites, one of them inside an onSnapshot callback.
 *
 * The profile fields live on the membership document, so there is nothing left
 * to join.
 */

const ROLE_ORDER: Record<string, number> = {
	[Role.OWNER]: 0,
	[Role.MANAGER]: 1,
	[Role.USER]: 2,
};

export type Member = Membership & { displayName: string };

export function useCompanyMembers(companyId: string) {
	const [members, setMembers] = useState<Membership[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (!companyId) {
			setMembers([]);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		return subscribeMembers(companyId, (next) => {
			setMembers(next);
			setIsLoading(false);
		});
	}, [companyId]);

	const sorted = useMemo<Member[]>(
		() =>
			[...members]
				.map((m) => ({
					...m,
					displayName:
						`${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() ||
						m.email ||
						m.userId,
				}))
				.sort((a, b) => {
					// Owners, then managers, then everyone else; alphabetical within.
					const byRole =
						(ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
					return byRole !== 0
						? byRole
						: a.displayName.localeCompare(b.displayName);
				}),
		[members],
	);

	/** Lookup by user id, for resolving assignment lists to names. */
	const byUserId = useMemo(
		() => Object.fromEntries(sorted.map((m) => [m.userId, m])),
		[sorted],
	);

	/**
	 * Resolves assigned user ids to display names.
	 *
	 * Unknown ids become "Former member" rather than disappearing — production
	 * has 48 assignments pointing at deleted users, and silently dropping them
	 * would make an event look under-staffed.
	 */
	const namesFor = useMemo(
		() => (userIds: string[]) =>
			(userIds ?? []).map(
				(id) => byUserId[id]?.displayName ?? "Former member",
			),
		[byUserId],
	);

	return { members: sorted, byUserId, namesFor, isLoading };
}
