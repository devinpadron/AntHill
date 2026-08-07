import {
	getFirestore as mGetFirestore,
	collection as mCollection,
	doc as mDoc,
	query as mQuery,
	where as mWhere,
	orderBy as mOrderBy,
	limit as mLimit,
	startAfter as mStartAfter,
	getDoc,
	getDocs,
	getDocFromCache,
	getDocsFromCache,
	getDocFromServer,
	getDocsFromServer,
	getCountFromServer,
	onSnapshot as mOnSnapshot,
	setDoc,
	updateDoc,
	deleteDoc,
	writeBatch,
	runTransaction as mRunTransaction,
	serverTimestamp,
	increment,
	arrayUnion,
	arrayRemove,
	deleteField,
	documentId,
	Timestamp,
	type Firestore,
	type DocumentData,
	type DocumentReference as MDocRef,
	type CollectionReference as MCollRef,
	type Query as MQueryType,
	type DocumentSnapshot as MDocSnap,
	type QuerySnapshot as MQuerySnap,
	type Transaction as MTransaction,
	type WriteBatch as MWriteBatch,
	type SetOptions,
	type WhereFilterOp,
	type OrderByDirection,
	type FirestoreError,
	type FieldPath as MFieldPath,
	type SnapshotMetadata,
} from "firebase/firestore";
import type { FirebaseApp } from "firebase/app";

/*
 * Stands in for `@react-native-firebase/firestore`.
 *
 * The service layer in ../../src/services is shared verbatim with the mobile
 * app and is written against RNFirebase's chaining API
 * (`db.collection(x).where(...).limit(n).get()`). This module re-exposes that
 * API over the Firebase web SDK's modular functions.
 *
 * WHY MODULAR AND NOT `firebase/compat`, which offers the same chaining shape:
 *
 *   1. `.exists`. RNFirebase v23 declares `exists(): boolean` — a METHOD — and
 *      the services call it as one in 23 places. compat declares it as a
 *      readonly PROPERTY, so `doc.exists()` there is "not a function" and every
 *      missing-document check throws. tools/check-layering.sh rule 6 exists to
 *      police exactly this. The modular SDK also declares it as a method, so
 *      the two agree.
 *
 *   2. Named databases. Under __DEV__ the app talks to a database literally
 *      named "test" (src/constants/database.ts). compat's accessor takes no
 *      databaseId and can only ever return "(default)" — a dev build would
 *      silently read and write PRODUCTION. Modular has
 *      getFirestore(app, databaseId).
 *
 * The wrapper classes below carry a `_` handle to the modular object they wrap.
 * Unwrapping happens at exactly the points where a wrapped value is handed back
 * into the modular SDK: batch/transaction writes, and startAfter cursors.
 *
 * SCOPE. This covers what the services actually use and nothing more — no
 * .add(), no collectionGroup(). If a service grows a new call, add it here; do
 * not work around it at the call site, because the mobile app has to keep
 * running the same line of code.
 *
 * `.metadata`, GetOptions and the options-first onSnapshot WERE outside that
 * scope and are now in it, because the offline work needs all three:
 *   - metadata.fromCache / .hasPendingWrites is how a screen tells a local
 *     write from an acknowledged one (src/types/sync.ts);
 *   - get({source:"cache"}) is how appConfigService avoids blocking a cold
 *     offline launch for ~10s on a server timeout;
 *   - onSnapshot({includeMetadataChanges:true}, ...) is REQUIRED for the first
 *     of those to ever go back to false — an acknowledgement does not change
 *     the document, so without it no further snapshot is raised.
 * They matter less in a browser (the web SDK defaults to memory persistence)
 * but the services are shared source, so the shape has to exist.
 */

/* ----------------------------------------------------------------- options */

/** RNFirebase's GetOptions. `default` tries the server, then falls back. */
export type GetOptions = { source?: "default" | "server" | "cache" };

/** RNFirebase's SnapshotListenOptions. */
export type ListenOptions = { includeMetadataChanges?: boolean };

/**
 * True when the first argument is an options bag rather than a callback.
 *
 * RNFirebase overloads onSnapshot on argument TYPE, not arity, so this has to
 * discriminate by shape — `typeof x === "function"` is the only reliable test,
 * since an options object and a callback can both be the sole argument.
 */
function isListenOptions(value: unknown): value is ListenOptions {
	return typeof value === "object" && value !== null;
}

/* ------------------------------------------------------------- snapshots */

export class DocSnap {
	constructor(readonly _s: MDocSnap<DocumentData>) {}

	get id() {
		return this._s.id;
	}

	get ref(): DocRef {
		return new DocRef(this._s.ref);
	}

	/** fromCache / hasPendingWrites. See src/types/sync.ts. */
	get metadata(): SnapshotMetadata {
		return this._s.metadata;
	}

	/** A METHOD, matching RNFirebase v23. See the note at the top of the file. */
	exists(): boolean {
		return this._s.exists();
	}

	data(): DocumentData | undefined {
		return this._s.data();
	}

	get(fieldPath: string): unknown {
		return this._s.get(fieldPath);
	}
}

export class QuerySnap {
	readonly docs: DocSnap[];

	constructor(readonly _s: MQuerySnap<DocumentData>) {
		this.docs = _s.docs.map((d) => new DocSnap(d));
	}

	get empty() {
		return this._s.empty;
	}

	get size() {
		return this._s.size;
	}

	/** fromCache / hasPendingWrites for the query as a whole. */
	get metadata(): SnapshotMetadata {
		return this._s.metadata;
	}

	forEach(fn: (doc: DocSnap) => void): void {
		this.docs.forEach(fn);
	}
}

/* --------------------------------------------------------------- queries */

export class Q {
	constructor(readonly _q: MQueryType<DocumentData>) {}

	/**
	 * `fieldPath` accepts a FieldPath as well as a string —
	 * `where(firestore.FieldPath.documentId(), "in", ids)` is how
	 * companyService, libraryService and eventService fetch documents by id.
	 */
	where(
		fieldPath: string | MFieldPath,
		opStr: WhereFilterOp,
		value: unknown,
	): Q {
		return new Q(mQuery(this._q, mWhere(fieldPath, opStr, value)));
	}

	orderBy(
		fieldPath: string | MFieldPath,
		directionStr?: OrderByDirection,
	): Q {
		return new Q(mQuery(this._q, mOrderBy(fieldPath, directionStr)));
	}

	limit(n: number): Q {
		return new Q(mQuery(this._q, mLimit(n)));
	}

	/**
	 * Accepts the wrapped DocSnap the services carry around as a page cursor
	 * (timeEntryService.getTimeEntries returns one), and unwraps it.
	 */
	startAfter(snapshot: DocSnap | unknown): Q {
		const cursor =
			snapshot instanceof DocSnap ? snapshot._s : (snapshot as never);
		return new Q(mQuery(this._q, mStartAfter(cursor)));
	}

	/**
	 * `source` selects the cache or the server explicitly.
	 *
	 * A cache-only read REJECTS when nothing is cached (rather than returning
	 * empty), so callers treat a rejection as a miss and fall through to the
	 * network — see appConfigService.
	 */
	async get(options?: GetOptions): Promise<QuerySnap> {
		if (options?.source === "cache") {
			return new QuerySnap(await getDocsFromCache(this._q));
		}
		if (options?.source === "server") {
			return new QuerySnap(await getDocsFromServer(this._q));
		}
		return new QuerySnap(await getDocs(this._q));
	}

	/**
	 * Aggregate count, in RNFirebase's two-step shape: `query.count().get()`
	 * resolving to something whose `.data().count` is the number.
	 *
	 * Billed per index entry read rather than per document, so it is the only
	 * affordable way to total a collection the client is not going to fetch.
	 * Any `limit()` already applied is ignored by the server, which is what
	 * callers want — a count of the whole matching set, not of one page.
	 */
	count(): AggregateQ {
		return new AggregateQ(this._q);
	}

	onSnapshot(
		onNext: (snapshot: QuerySnap) => void,
		onError?: (error: FirestoreError) => void,
	): () => void;
	onSnapshot(
		options: ListenOptions,
		onNext: (snapshot: QuerySnap) => void,
		onError?: (error: FirestoreError) => void,
	): () => void;
	onSnapshot(
		a: ListenOptions | ((snapshot: QuerySnap) => void),
		b?: ((snapshot: QuerySnap) => void) | ((error: FirestoreError) => void),
		c?: (error: FirestoreError) => void,
	): () => void {
		const options = isListenOptions(a) ? a : undefined;
		const onNext = (options ? b : a) as (snapshot: QuerySnap) => void;
		const onError = ((options ? c : b) ?? (() => {})) as (
			error: FirestoreError,
		) => void;

		const forward = (snapshot: MQuerySnap<DocumentData>) =>
			onNext(new QuerySnap(snapshot));

		return options
			? mOnSnapshot(this._q, options, forward, onError)
			: mOnSnapshot(this._q, forward, onError);
	}
}

export class AggregateQ {
	constructor(readonly _q: MQueryType<DocumentData>) {}

	async get(): Promise<{ data: () => { count: number } }> {
		const snapshot = await getCountFromServer(this._q);
		const { count } = snapshot.data();
		return { data: () => ({ count }) };
	}
}

/* ------------------------------------------------------------ references */

export class DocRef {
	constructor(readonly _r: MDocRef<DocumentData>) {}

	get id() {
		return this._r.id;
	}

	get path() {
		return this._r.path;
	}

	/** Subcollections — timeEntries/{id}/connections and /edits. */
	collection(collectionPath: string): CollRef {
		return new CollRef(mCollection(this._r, collectionPath));
	}

	/** See Q.get — a cache-only read rejects on a miss rather than returning empty. */
	async get(options?: GetOptions): Promise<DocSnap> {
		if (options?.source === "cache") {
			return new DocSnap(await getDocFromCache(this._r));
		}
		if (options?.source === "server") {
			return new DocSnap(await getDocFromServer(this._r));
		}
		return new DocSnap(await getDoc(this._r));
	}

	/** Supports both `{merge}` and `{mergeFields}` (eventChecklistService). */
	set(data: DocumentData, options?: SetOptions): Promise<void> {
		return options ? setDoc(this._r, data, options) : setDoc(this._r, data);
	}

	/** Dotted field paths pass straight through, as they do in RNFirebase. */
	update(data: DocumentData): Promise<void> {
		return updateDoc(this._r, data);
	}

	delete(): Promise<void> {
		return deleteDoc(this._r);
	}

	onSnapshot(
		onNext: (snapshot: DocSnap) => void,
		onError?: (error: FirestoreError) => void,
	): () => void;
	onSnapshot(
		options: ListenOptions,
		onNext: (snapshot: DocSnap) => void,
		onError?: (error: FirestoreError) => void,
	): () => void;
	onSnapshot(
		a: ListenOptions | ((snapshot: DocSnap) => void),
		b?: ((snapshot: DocSnap) => void) | ((error: FirestoreError) => void),
		c?: (error: FirestoreError) => void,
	): () => void {
		const options = isListenOptions(a) ? a : undefined;
		const onNext = (options ? b : a) as (snapshot: DocSnap) => void;
		const onError = ((options ? c : b) ?? (() => {})) as (
			error: FirestoreError,
		) => void;

		const forward = (snapshot: MDocSnap<DocumentData>) =>
			onNext(new DocSnap(snapshot));

		return options
			? mOnSnapshot(this._r, options, forward, onError)
			: mOnSnapshot(this._r, forward, onError);
	}
}

export class CollRef extends Q {
	constructor(readonly _c: MCollRef<DocumentData>) {
		super(_c);
	}

	/** No argument generates an auto-id, matching RNFirebase. */
	doc(documentPath?: string): DocRef {
		return new DocRef(
			documentPath ? mDoc(this._c, documentPath) : mDoc(this._c),
		);
	}
}

/* ------------------------------------------------------ batch/transaction */

export class Batch {
	constructor(private readonly _b: MWriteBatch) {}

	set(ref: DocRef, data: DocumentData, options?: SetOptions): Batch {
		if (options) this._b.set(ref._r, data, options);
		else this._b.set(ref._r, data);
		return this;
	}

	update(ref: DocRef, data: DocumentData): Batch {
		this._b.update(ref._r, data);
		return this;
	}

	delete(ref: DocRef): Batch {
		this._b.delete(ref._r);
		return this;
	}

	commit(): Promise<void> {
		return this._b.commit();
	}
}

export class Tx {
	constructor(private readonly _t: MTransaction) {}

	async get(ref: DocRef): Promise<DocSnap> {
		return new DocSnap(await this._t.get(ref._r));
	}

	set(ref: DocRef, data: DocumentData, options?: SetOptions): Tx {
		if (options) this._t.set(ref._r, data, options);
		else this._t.set(ref._r, data);
		return this;
	}

	update(ref: DocRef, data: DocumentData): Tx {
		this._t.update(ref._r, data);
		return this;
	}

	delete(ref: DocRef): Tx {
		this._t.delete(ref._r);
		return this;
	}
}

/* --------------------------------------------------------- the db handle */

export class Db {
	constructor(readonly _f: Firestore) {}

	collection(collectionPath: string): CollRef {
		return new CollRef(mCollection(this._f, collectionPath));
	}

	doc(documentPath: string): DocRef {
		return new DocRef(mDoc(this._f, documentPath));
	}

	batch(): Batch {
		return new Batch(writeBatch(this._f));
	}

	runTransaction<T>(updateFunction: (tx: Tx) => Promise<T>): Promise<T> {
		return mRunTransaction(this._f, (t) => updateFunction(new Tx(t)));
	}
}

/**
 * Mirrors the two call shapes in src/lib/db.ts exactly:
 *   getFirestore(app)              → "(default)"
 *   getFirestore(app, DATABASE_ID) → a named database
 */
export function getFirestore(app: FirebaseApp, databaseId?: string): Db {
	return new Db(
		databaseId ? mGetFirestore(app, databaseId) : mGetFirestore(app),
	);
}

/* ----------------------------------------------- the `firestore.*` statics */

/*
 * Services do `import firestore from "@react-native-firebase/firestore"` and
 * then reach for firestore.FieldValue / FieldPath / Timestamp. The modular
 * equivalents are plain functions, so these namespaces just re-bundle them.
 */
export const FieldValue = {
	serverTimestamp,
	increment,
	arrayUnion,
	arrayRemove,
	delete: deleteField,
};

export const FieldPath = {
	documentId,
};

export { Timestamp };

export default { FieldValue, FieldPath, Timestamp };

/* -------------------------------------------------------- type namespace */

export type { FirebaseFirestoreTypes } from "./firestore-types";
