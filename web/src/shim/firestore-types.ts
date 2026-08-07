import type {
	Timestamp as MTimestamp,
	SnapshotMetadata as MSnapshotMetadata,
} from "firebase/firestore";
import type {
	DocSnap,
	QuerySnap,
	Q,
	DocRef,
	CollRef,
	GetOptions as ShimGetOptions,
	ListenOptions,
} from "./rnfb-firestore";

/*
 * The `FirebaseFirestoreTypes` namespace, as the shared service layer imports
 * it. Only four members are actually referenced across ../../src — verified by
 * grep — but the rest are cheap and keep a future service from needing an app
 * change:
 *
 *   FirebaseFirestoreTypes.DocumentSnapshot  ×7   (timeEntryService cursor, …)
 *   FirebaseFirestoreTypes.Query             ×4   (buildQuery return types)
 *   FirebaseFirestoreTypes.Timestamp         ×1   (src/types/common.ts)
 *   FirebaseFirestoreTypes.QuerySnapshot     ×1   (libraryService mapDocs)
 *
 * This lives in its own file rather than inside rnfb-firestore.ts so that the
 * type-only `namespace` can never end up in esbuild's emitted JavaScript —
 * esbuild transpiles file-by-file without type information, and a namespace
 * sitting next to runtime exports is the shape most likely to confuse it.
 *
 * `Timestamp` maps to the modular class, which carries the same .toDate(),
 * .toMillis() and static .fromDate() the app relies on — so src/types/common.ts
 * resolves correctly here with no change.
 */
export namespace FirebaseFirestoreTypes {
	export type Timestamp = MTimestamp;
	export type DocumentSnapshot = DocSnap;
	export type QueryDocumentSnapshot = DocSnap;
	export type QuerySnapshot = QuerySnap;
	export type Query = Q;
	export type DocumentReference = DocRef;
	export type CollectionReference = CollRef;
	export type DocumentData = Record<string, any>;
	export type FieldValue = unknown;
	export type SnapshotMetadata = MSnapshotMetadata;
	export type GetOptions = ShimGetOptions;
	export type SnapshotListenOptions = ListenOptions;
}
