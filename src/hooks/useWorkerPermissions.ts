import { useMemo } from "react";
import { useUser } from "../contexts/UserContext";
import { useCompany } from "../contexts/CompanyContext";
import { useGroups } from "./useGroups";
import { GroupPermissions } from "../types";
import {
	baselinePermissions,
	resolvePermissions,
} from "../utils/permissionUtils";

/** What the signed-in worker may see and do. See permissionUtils for the rules. */
export function useWorkerPermissions(): GroupPermissions {
	const { companyId, isAdmin, membership } = useUser();
	const { preferences } = useCompany();
	const { byId } = useGroups(companyId ?? "");

	const groupIds = membership?.groupIds ?? [];

	return useMemo(
		() =>
			resolvePermissions(
				Boolean(isAdmin),
				// A deleted group still on the membership resolves to nothing.
				groupIds.map((id) => byId[id]).filter(Boolean),
				baselinePermissions(preferences),
			),
		[isAdmin, groupIds.join(","), byId, preferences],
	);
}
