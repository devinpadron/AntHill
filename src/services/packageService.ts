import db from "../constants/firestore";

/**
 * Fetches all packages for a company
 * @param {string} companyId - The company ID
 * @returns {Promise<Array>} - Array of package objects
 */
export const getPackages = async (companyId) => {
	try {
		const packagesSnapshot = await db
			.collection("Companies")
			.doc(companyId)
			.collection("Packages")
			.orderBy("title")
			.get();

		return packagesSnapshot.docs.map((doc) => ({
			id: doc.id,
			...doc.data(),
			isSelected: false, // Add this property for UI tracking
		}));
	} catch (error) {
		console.error("Error fetching packages:", error);
		return [];
	}
};

/**
 * Gets packages attached to an event
 * @param {string} companyId - The company ID
 * @param {string} eventId - The event ID
 * @returns {Promise<Array>} - Array of package IDs
 */
export const getEventPackages = async (companyId, eventId) => {
	try {
		const eventDoc = await db
			.collection("Companies")
			.doc(companyId)
			.collection("Events")
			.doc(eventId)
			.get();

		const eventData = eventDoc.data();
		return eventData.packages || [];
	} catch (error) {
		console.error("Error fetching event packages:", error);
		return [];
	}
};

/**
 * Fetches details for a specific package and populates checklist titles
 * @param {string} companyId - The company ID
 * @param {string} packageId - The package ID
 * @returns {Promise<Object|null>} - The package details with checklist titles
 */
export const getPackageDetails = async (companyId, packageId) => {
	try {
		const packageDoc = await db
			.collection("Companies")
			.doc(companyId)
			.collection("Packages")
			.doc(packageId)
			.get();

		if (!packageDoc.exists) return null;

		const packageData = {
			id: packageDoc.id,
			...packageDoc.data(),
		} as any;

		// Fetch checklist details for each checklist in the package
		if (packageData.checklists && packageData.checklists.length > 0) {
			const checklistDetailsPromises = packageData.checklists.map(
				async (checklist) => {
					const checklistDoc = await db
						.collection("Companies")
						.doc(companyId)
						.collection("Checklists")
						.doc(checklist.checklistId)
						.get();

					if (checklistDoc.exists) {
						const checklistData = checklistDoc.data();
						return {
							...checklist,
							title: checklistData.title,
							itemCount: checklistData.items?.length || 0,
						};
					}
					return checklist;
				},
			);

			packageData.checklists = await Promise.all(
				checklistDetailsPromises,
			);
		}

		return packageData;
	} catch (error) {
		console.error(`Error fetching package ${packageId}:`, error);
		return null;
	}
};

/**
 * Fetches a single checklist by ID
 * @param {string} companyId - The company ID
 * @param {string} checklistId - The checklist ID
 * @returns {Promise<Object|null>} - The checklist details or null if not found
 */
export const getChecklistById = async (companyId, checklistId) => {
	try {
		const checklistDoc = await db
			.collection("Companies")
			.doc(companyId)
			.collection("Checklists")
			.doc(checklistId)
			.get();

		if (!checklistDoc.exists) return null;

		return {
			id: checklistDoc.id,
			...checklistDoc.data(),
		};
	} catch (error) {
		console.error(`Error fetching checklist ${checklistId}:`, error);
		return null;
	}
};
