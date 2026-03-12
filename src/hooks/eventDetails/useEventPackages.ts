import { useState, useEffect } from "react";
import { getPackageDetails } from "../../services/packageService";

/**
 * useEventPackages - Fetches and manages package data for an event
 *
 * @param packageIds - Array of package IDs from the event
 * @param companyId - The current company ID
 * @returns Package data, loading state, and total checklist count
 */
export const useEventPackages = (
	packageIds: string[] | undefined,
	companyId: string,
) => {
	const [packages, setPackages] = useState<any[]>([]);
	const [loadingPackages, setLoadingPackages] = useState(false);

	useEffect(() => {
		if (!packageIds || packageIds.length === 0 || !companyId) {
			setPackages([]);
			return;
		}

		const fetchPackages = async () => {
			setLoadingPackages(true);
			try {
				const packagePromises = packageIds.map((packageId) =>
					getPackageDetails(companyId, packageId),
				);
				const packageResults = await Promise.all(packagePromises);
				setPackages(packageResults.filter((pkg) => pkg !== null));
			} catch (error) {
				console.error("Error loading packages:", error);
			} finally {
				setLoadingPackages(false);
			}
		};

		fetchPackages();
	}, [packageIds, companyId]);

	const totalChecklists = packages.reduce(
		(total, pkg) => total + (pkg.checklists?.length || 0),
		0,
	);

	return { packages, loadingPackages, totalChecklists };
};
