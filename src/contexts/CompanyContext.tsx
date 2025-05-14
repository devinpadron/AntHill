import React, {
	createContext,
	useState,
	useEffect,
	useCallback,
	useContext,
	ReactNode,
} from "react";
import db from "../constants/firestore";
import {
	getCompanyPreferences,
	updateCompanyPreferences,
} from "../services/companyService";

export interface CompanyPreferences {
	workWeekStarts: "sunday" | "monday";
	allowUserEventEditing: boolean;
	enableTimeSheet: boolean;
	timeEntryForm: any;
}

export interface CompanyData {
	id: string;
	name: string;
	accessCode: string;
	personal: boolean;
}

interface CompanyContextType {
	companyData: CompanyData | null;
	preferences: CompanyPreferences;
	isLoading: boolean;
	error: Error | null;
	updatePreferences: (
		newPreferences:
			| Partial<CompanyPreferences>
			| ((prev: CompanyPreferences) => CompanyPreferences),
	) => Promise<void>;
	setActiveCompany: (companyId: string) => void;
}

// Default preferences
const defaultPreferences: CompanyPreferences = {
	workWeekStarts: "sunday",
	allowUserEventEditing: false,
	enableTimeSheet: true,
	timeEntryForm: {
		title: "Time Entry Form",
		description:
			"Please complete this form when submitting your time entry",
		fields: [],
		isEnabled: true,
	},
};

// Create context with default values
export const CompanyContext = createContext<CompanyContextType>({
	companyData: null,
	preferences: defaultPreferences,
	isLoading: false,
	error: null,
	updatePreferences: async () => {},
	setActiveCompany: () => {},
});

interface CompanyProviderProps {
	children: ReactNode;
}

export const CompanyProvider: React.FC<CompanyProviderProps> = ({
	children,
}) => {
	const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [companyData, setCompanyData] = useState<CompanyData | null>(null);
	const [preferences, setPreferences] =
		useState<CompanyPreferences>(defaultPreferences);

	// Fetch company data when company ID changes
	useEffect(() => {
		const fetchCompanyData = async () => {
			if (!activeCompanyId) {
				return;
			}

			setIsLoading(true);
			setError(null);

			try {
				// Get company document
				const companyDoc = await db
					.collection("Companies")
					.doc(activeCompanyId)
					.get();

				if (!companyDoc.exists) {
					throw new Error("Company not found");
				}

				const data = companyDoc.data();
				setCompanyData({
					id: activeCompanyId,
					name: data?.name || "Unknown Company",
					accessCode: data?.accessCode || "",
					personal: data?.personal || false,
				});

				// Get company preferences
				const prefs = await getCompanyPreferences(activeCompanyId);
				if (prefs) {
					setPreferences({
						...defaultPreferences, // Keep defaults
						...prefs, // Override with stored preferences
					});
				} else {
					// Reset to default if no preferences found
					setPreferences(defaultPreferences);
				}
			} catch (err) {
				console.error("Error fetching company data:", err);
				setError(err as Error);
			} finally {
				setIsLoading(false);
			}
		};

		fetchCompanyData();
	}, [activeCompanyId]);

	// Set active company ID
	const setActiveCompany = useCallback((companyId: string) => {
		setActiveCompanyId(companyId);
	}, []);

	// Update preferences
	const updatePreferences = useCallback(
		async (
			newPreferences:
				| Partial<CompanyPreferences>
				| ((prev: CompanyPreferences) => CompanyPreferences),
		) => {
			if (!activeCompanyId) return;

			try {
				setIsLoading(true);

				const updatedPreferences =
					typeof newPreferences === "function"
						? newPreferences(preferences)
						: { ...preferences, ...newPreferences };

				const success = await updateCompanyPreferences(
					activeCompanyId,
					updatedPreferences,
				);

				if (success) {
					setPreferences(updatedPreferences);
				} else {
					throw new Error("Failed to update preferences");
				}
			} catch (err) {
				console.error("Error updating preferences:", err);
				setError(err as Error);
			} finally {
				setIsLoading(false);
			}
		},
		[activeCompanyId, preferences],
	);

	const contextValue: CompanyContextType = {
		companyData,
		preferences,
		isLoading,
		error,
		updatePreferences,
		setActiveCompany,
	};

	return (
		<CompanyContext.Provider value={contextValue}>
			{children}
		</CompanyContext.Provider>
	);
};

// Custom hook for using company context
export const useCompany = () => {
	const context = useContext(CompanyContext);

	if (context === undefined) {
		throw new Error("useCompany must be used within a CompanyProvider");
	}

	return context;
};
