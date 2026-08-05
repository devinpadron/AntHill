import { useEffect, useMemo, useState } from "react";
import { subscribeGroups } from "../services/groupService";
import { Group } from "../types";

/*
 * The company's worker groups.
 *
 * Small and long-lived — a catering company has a handful — so this is a plain
 * live subscription with no paging.
 */
export function useGroups(companyId: string) {
	const [groups, setGroups] = useState<Group[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (!companyId) {
			setGroups([]);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		return subscribeGroups(companyId, (next) => {
			setGroups(next);
			setIsLoading(false);
		});
	}, [companyId]);

	const byId = useMemo(
		() => Object.fromEntries(groups.map((g) => [g.id, g])),
		[groups],
	);

	/**
	 * Group ids to names.
	 *
	 * An id with no group resolves to "Deleted group" rather than vanishing —
	 * a worker silently belonging to nothing is exactly the state that makes
	 * "why am I not seeing jobs?" impossible to diagnose.
	 */
	const namesFor = useMemo(
		() => (groupIds: string[]) =>
			(groupIds ?? []).map((id) => byId[id]?.name ?? "Deleted group"),
		[byId],
	);

	return { groups, byId, namesFor, isLoading };
}
