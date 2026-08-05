import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

/*
 * Shared conventions for the v2 schema. These exist to kill the seven competing
 * timestamp formats and the two different fields named `duration` (v1 had
 * Event.duration as a STRING of hours and TimeEntry.duration as a NUMBER of
 * seconds).
 *
 *   - every instant is a Timestamp, in a field ending `At`
 *   - every calendar day is a "YYYY-MM-DD" string, in a field ending `Key`
 *   - every duration is whole seconds, in a field ending `Seconds`
 */

export type Timestamp = FirebaseFirestoreTypes.Timestamp;

/** A local calendar day, "YYYY-MM-DD". */
export type DateKey = string;

export const SCHEMA_VERSION = 2 as const;

/** Present on every v2 document. */
export interface BaseDoc {
	id: string;
	createdAt: Timestamp;
	updatedAt: Timestamp;
	schemaVersion: number;
}

/**
 * Present on every company-scoped v2 document.
 *
 * `companyId` is load-bearing, not decorative: the security rules read
 * `resource.data.companyId`, which makes Firestore reject any query that does
 * not filter on it. That is what keeps a flat top-level collection scoped.
 */
export interface CompanyScoped {
	companyId: string;
}
