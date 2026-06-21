#!/usr/bin/env node

/**
 * Firestore Full Export Script
 *
 * Exports all collections and subcollections from a Firestore database to a JSON file.
 *
 * Usage:
 *   node scripts/export-firestore.js [--db <databaseId>] [--out <outputFile>]
 *
 * Options:
 *   --db   Firestore database ID (default: "(default)")
 *          Use "--db test" to export the test database
 *   --out  Output file path (default: "firestore-export.json")
 *
 * Prerequisites:
 *   1. Install firebase-admin:  npm install firebase-admin
 *   2. Authenticate via one of:
 *      a) Set GOOGLE_APPLICATION_CREDENTIALS env var to a service account key JSON file
 *      b) Run `gcloud auth application-default login` (requires gcloud CLI)
 */

const {
	initializeApp,
	cert,
	applicationDefault,
} = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

// --- Parse CLI args ---
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
	const idx = args.indexOf(flag);
	if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
	return defaultValue;
}

const databaseId = getArg("--db", "(default)");
const outputFile = getArg("--out", "firestore-export.json");

// --- Initialize Firebase Admin ---
const projectId = "anthill-51de0";

let credential;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
	credential = cert(
		require(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)),
	);
} else {
	credential = applicationDefault();
}

const app = initializeApp({ credential, projectId });
const db = getFirestore(app, databaseId);

// --- Recursive export ---

/**
 * Recursively export a single document and all its subcollections.
 */
async function exportDocument(docRef) {
	const docSnap = await docRef.get();
	if (!docSnap.exists) return null;

	const data = docSnap.data();
	const result = { _id: docSnap.id, ...serializeFields(data) };

	// Discover and export subcollections
	const subcollections = await docRef.listCollections();
	for (const subCol of subcollections) {
		result[subCol.id] = await exportCollection(subCol);
	}

	return result;
}

/**
 * Export all documents in a collection (with their subcollections).
 */
async function exportCollection(collectionRef) {
	const snapshot = await collectionRef.get();
	const docs = [];
	for (const docSnap of snapshot.docs) {
		const doc = await exportDocument(docSnap.ref);
		if (doc) docs.push(doc);
	}
	return docs;
}

/**
 * Serialize Firestore field values (Timestamps, GeoPoints, DocumentReferences)
 * into plain JSON-friendly objects.
 */
function serializeFields(obj) {
	if (obj === null || obj === undefined) return obj;

	// Firestore Timestamp
	if (obj.toDate && typeof obj.toDate === "function") {
		return obj.toDate().toISOString();
	}

	// Firestore GeoPoint
	if (
		typeof obj.latitude === "number" &&
		typeof obj.longitude === "number" &&
		Object.keys(obj).length === 2
	) {
		return {
			_type: "GeoPoint",
			latitude: obj.latitude,
			longitude: obj.longitude,
		};
	}

	// Firestore DocumentReference
	if (obj.path && obj.firestore) {
		return { _type: "DocumentReference", path: obj.path };
	}

	// Arrays
	if (Array.isArray(obj)) {
		return obj.map(serializeFields);
	}

	// Plain objects
	if (typeof obj === "object") {
		const result = {};
		for (const [key, value] of Object.entries(obj)) {
			result[key] = serializeFields(value);
		}
		return result;
	}

	return obj;
}

// --- Main ---
async function main() {
	console.log(
		`Exporting Firestore database: "${databaseId}" (project: ${projectId})`,
	);
	console.log(`Output file: ${outputFile}\n`);

	const rootCollections = await db.listCollections();
	console.log(
		`Found ${rootCollections.length} root collection(s): ${rootCollections.map((c) => c.id).join(", ")}\n`,
	);

	const exportData = {};
	for (const collection of rootCollections) {
		console.log(`Exporting collection: ${collection.id} ...`);
		exportData[collection.id] = await exportCollection(collection);
		console.log(`  → ${exportData[collection.id].length} document(s)`);
	}

	const outputPath = path.resolve(outputFile);
	fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), "utf-8");
	console.log(`\nExport complete! Written to ${outputPath}`);
}

main().catch((err) => {
	console.error("Export failed:", err);
	process.exit(1);
});
