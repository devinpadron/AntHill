import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import {
	defaultPreferences,
	subscribeCompany,
	subscribePreferences,
	updatePreferences as writePreferences,
} from "@app/services/companyService";
import type { Company, CompanyPreferences, Membership } from "@app/types";
import { Role } from "@app/types/enums/Role";

/*
 * The active company, its live preferences, and the signed-in admin's
 * membership in it.
 *
 * A near-copy of ../../src/contexts/CompanyContext.tsx — that file has no
 * react-native dependency at all, but its relative imports resolve wrongly from
 * here and it reads companyId from useUser(). The portal takes companyId as a
 * PROP instead, because the URL owns it (see routing/CompanyGuard.tsx).
 *
 * Company and preferences are both LIVE subscriptions, as in the app. That
 * matters for the same reason: preferences feature-flag whole sections, so an
 * admin toggling `enableTimeSheet` should change the sidebar without a reload.
 *
 * `membership` is added here rather than in AuthContext because role is
 * per-company — a user can be an owner of one and a manager of another, and
 * isAdmin has to be re-derived whenever the active company changes.
 */

const FALLBACK_TIME_ZONE = "America/New_York";

type CompanyContextValue = {
	companyId: string;
	company: Company | null;
	preferences: CompanyPreferences;
	timeZone: string;
	membership: Membership | null;
	role: Role | "";
	isAdmin: boolean;
	isOwner: boolean;
	isLoading: boolean;
	updatePreferences: (patch: Partial<CompanyPreferences>) => Promise<void>;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({
	companyId,
	membership,
	children,
}: {
	companyId: string;
	/** Resolved and authorized by CompanyGuard before this mounts. */
	membership: Membership;
	children: ReactNode;
}) {
	const [company, setCompany] = useState<Company | null>(null);
	const [preferences, setPreferences] =
		useState<CompanyPreferences>(defaultPreferences);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		setIsLoading(true);
		const unsubscribeCompany = subscribeCompany(companyId, (next) => {
			setCompany(next);
			setIsLoading(false);
		});
		const unsubscribePreferences = subscribePreferences(
			companyId,
			setPreferences,
		);

		return () => {
			unsubscribeCompany();
			unsubscribePreferences();
		};
	}, [companyId]);

	/**
	 * Field-level patch only — never a whole-object write.
	 *
	 * The app's comment explains why: v1 spread the entire preferences object
	 * from local state, so an admin on a stale device could revive superseded
	 * values. A second admin client makes that hazard worse, not better.
	 */
	const updatePreferences = useCallback(
		async (patch: Partial<CompanyPreferences>) => {
			await writePreferences(companyId, patch);
		},
		[companyId],
	);

	const value = useMemo<CompanyContextValue>(
		() => ({
			companyId,
			company,
			preferences,
			timeZone: company?.timeZone || FALLBACK_TIME_ZONE,
			membership,
			role: membership.role,
			isAdmin:
				membership.role === Role.MANAGER ||
				membership.role === Role.OWNER,
			isOwner: membership.role === Role.OWNER,
			isLoading,
			updatePreferences,
		}),
		[
			companyId,
			company,
			preferences,
			membership,
			isLoading,
			updatePreferences,
		],
	);

	return (
		<CompanyContext.Provider value={value}>
			{children}
		</CompanyContext.Provider>
	);
}

export function useCompany(): CompanyContextValue {
	const value = useContext(CompanyContext);
	if (!value) {
		throw new Error("useCompany must be used inside a /:companyId route");
	}
	return value;
}
