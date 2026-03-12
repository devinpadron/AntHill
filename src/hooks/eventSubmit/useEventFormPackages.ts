import { useState, useEffect, useCallback } from "react";
import { getPackages, getEventPackages } from "../../services/packageService";

export const useEventFormPackages = (companyId: string, eventId?: string) => {
	const [availablePackages, setAvailablePackages] = useState([]);
	const [selectedPackages, setSelectedPackages] = useState([]);
	const [ogSelectedPackages, setOgSelectedPackages] = useState([]);
	const [loadingPackages, setLoadingPackages] = useState(false);
	const [openPackagesDropdown, setOpenPackagesDropdown] = useState(false);

	useEffect(() => {
		if (!companyId) return;

		const fetchPackagesData = async () => {
			setLoadingPackages(true);
			try {
				const packages = await getPackages(companyId);
				setAvailablePackages(packages);

				if (eventId) {
					const eventPackages = await getEventPackages(
						companyId,
						eventId,
					);
					if (eventPackages && eventPackages.length > 0) {
						setSelectedPackages(eventPackages);
						setOgSelectedPackages(eventPackages);
					}
				}
			} catch (error) {
				console.error("Error loading packages:", error);
			} finally {
				setLoadingPackages(false);
			}
		};

		fetchPackagesData();
	}, [companyId, eventId]);

	const togglePackageSelection = useCallback((packageId: string) => {
		setSelectedPackages((prev) =>
			prev.includes(packageId)
				? prev.filter((id) => id !== packageId)
				: [...prev, packageId],
		);
	}, []);

	return {
		availablePackages,
		selectedPackages,
		ogSelectedPackages,
		togglePackageSelection,
		loadingPackages,
		openPackagesDropdown,
		setOpenPackagesDropdown,
	};
};
