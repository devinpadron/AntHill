import React, {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import {
	defaultPreferences,
	subscribeCompany,
	subscribePreferences,
	updatePreferences as writePreferences,
} from "../services/companyService";
import { Company, CompanyPreferences } from "../types";
import { useUser } from "./UserContext";

/*
 * The active company and its preferences.
 *
 * Both are LIVE subscriptions. v1 read preferences once when the company was
 * selected (CompanyContext.tsx:93-140), and because HomeTabs feature-flags whole
 * tabs off `enableAvailability` / `enableTimeSheet`, an admin turning a feature
 * on did not reach anyone else until they relaunched the app.
 *
 * The company is also where `timeZone` comes from, which the time-entry and
 * calendar code needs to compute local day keys.
 */

type CompanyContextType = {
	company: Company | null;
	companyId: string | undefined;
	preferences: CompanyPreferences;
	timeZone: string;
	isLoading: boolean;
	updatePreferences: (patch: Partial<CompanyPreferences>) => Promise<void>;
};

const FALLBACK_TIME_ZONE = "America/New_York";

const CompanyContext = createContext<CompanyContextType>({
	company: null,
	companyId: undefined,
	preferences: defaultPreferences,
	timeZone: FALLBACK_TIME_ZONE,
	isLoading: true,
	updatePreferences: async () => {},
});

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
	// Driven directly by the user's active company, so v1's CompanyInitializer
	// bridge component is no longer needed.
	const { companyId } = useUser();

	const [company, setCompany] = useState<Company | null>(null);
	const [preferences, setPreferences] =
		useState<CompanyPreferences>(defaultPreferences);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (!companyId) {
			setCompany(null);
			setPreferences(defaultPreferences);
			setIsLoading(false);
			return;
		}

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
	 * Field-level patch.
	 *
	 * v1 spread the entire preferences object from local state into the write,
	 * so an admin on a stale device could revive superseded values. Callers pass
	 * only what changed.
	 */
	const updatePreferences = useCallback(
		async (patch: Partial<CompanyPreferences>) => {
			if (!companyId) return;
			await writePreferences(companyId, patch);
		},
		[companyId],
	);

	return (
		<CompanyContext.Provider
			value={{
				company,
				companyId,
				preferences,
				timeZone: company?.timeZone || FALLBACK_TIME_ZONE,
				isLoading,
				updatePreferences,
			}}
		>
			{children}
		</CompanyContext.Provider>
	);
};

export const useCompany = () => useContext(CompanyContext);
