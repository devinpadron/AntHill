import auth from "@react-native-firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import db from "../constants/firestore";

// Current schema version
const CURRENT_SCHEMA_VERSION = 1;
const SCHEMA_VERSION_KEY = "app_schema_version";

export async function checkAndRunMigrations() {
	try {
		// Get current user
		const currentUser = auth().currentUser;
		if (!currentUser) {
			console.log("No user logged in, skipping migration");
			return;
		}

		// Check if migration already run
		const storedVersion = await AsyncStorage.getItem(SCHEMA_VERSION_KEY);
		const userVersion = parseInt(storedVersion || "0");

		console.log(
			`Current schema: ${userVersion}, Target schema: ${CURRENT_SCHEMA_VERSION}`,
		);

		// Skip if already on current version
		if (userVersion >= CURRENT_SCHEMA_VERSION) {
			console.log("Database schema already up to date");
			return;
		}

		// Run migrations in sequence based on current version
		if (userVersion < 1) {
			if (!(await migrateToV1(currentUser.uid))) {
				console.log("Migration to v1 failed");
				return;
			}
		}

		// Update version in storage after successful migration
		await AsyncStorage.setItem(
			SCHEMA_VERSION_KEY,
			CURRENT_SCHEMA_VERSION.toString(),
		);
		console.log("Migration completed successfully");
	} catch (error) {
		console.error("Error during migration:", error);
		// You could implement retry logic or send error reports
	}
}

// Migration function to convert company relationships from object to array
// and move privileges to Company.Users collection
// This function assumes that the old structure is an object with company IDs as keys
// and privileges as values (e.g., { companyId1: "Owner", companyId2: "Admin" })
async function migrateToV1(userId: string) {
	console.log("Running migration to v1: Converting company relationships");
	const userRef = db.collection("Users").doc(userId);
	const userDoc = await userRef.get();

	if (!userDoc.exists) {
		console.log("User document not found");
		return false;
	}

	const userData = userDoc.data();
	const companies = userData?.companies;

	// Skip if companies is already an array or doesn't exist
	if (!companies || Array.isArray(companies)) {
		// Even if we don't need to convert companies, we should still add the ID
		if (!userData?.id) {
			await userRef.update({
				id: userId,
			});
			console.log("Added user ID to user document");
		}
		console.log("No companies to migrate or already in array format");
		return true;
	}

	console.log("Old company structure:", companies);

	// Start a batch write for atomic updates
	const batch = db.batch();

	// Extract the company IDs for the new array format
	const companyIds = Object.keys(companies);

	// Update the user document with just the array of company IDs and add userId field
	batch.update(userRef, {
		companies: companyIds,
		id: userId, // Add the user's ID to the user object
	});

	// For each company, add the user's privilege to Company.Users collection
	for (const companyId of companyIds) {
		var privilege = companies[companyId];
		switch (privilege) {
			case "Owner":
				privilege = "owner";
				break;
			case "Admin":
				privilege = "manager";
				break;
			default:
				privilege = "user";
		}
		const companyUserRef = db
			.collection("Companies")
			.doc(companyId)
			.collection("Users")
			.doc(userId);

		// Store the privilege in the Company.Users document
		batch.set(
			companyUserRef,
			{
				role: privilege,
				id: userId, // Also include user ID in the company-user relationship
			},
			{ merge: true },
		); // Use merge to avoid overwriting existing data
	}

	// Execute all the updates atomically
	await batch.commit();

	console.log(
		`Successfully migrated ${companyIds.length} companies from object to array format, moved privileges to Company.Users collection, and added user ID to user document`,
	);
	return true;
}
