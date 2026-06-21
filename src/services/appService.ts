import db from "../constants/firestore";

/**
 * Fetches the app-wide required version from the AppData/Data document.
 * Throws on failure; callers decide how to degrade.
 */
export async function getRequiredVersion(): Promise<string | undefined> {
	const data = await db.collection("AppData").doc("Data").get();
	return data.data()?.required_version;
}
