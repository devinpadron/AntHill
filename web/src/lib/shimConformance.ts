import firestore from "@react-native-firebase/firestore";
import db from "@app/lib/db";
import { C } from "@app/constants/paths";
import { DATABASE_ID, DATABASE_LABEL } from "@app/constants/database";

/*
 * Exercises every path through the Firestore chaining adapter in
 * src/shim/rnfb-firestore.ts against the live database.
 *
 * This is the highest-value test in the portal. The 14 services under
 * ../../src/services are shared verbatim with the mobile app and are never
 * modified; the ONLY thing standing between them and a browser is the adapter.
 * If every call shape below works, all 14 services work — and if one drifts,
 * this says which, instead of a screen somewhere rendering an empty list.
 *
 * THREE RULES THIS FILE LEARNED THE HARD WAY, all from a first run that failed
 * 12 of 18 checks without a single adapter bug among them:
 *
 *   1. Every query must be one the APP ACTUALLY MAKES. The first version
 *      queried memberships by companyId + orderBy(lastName) and failed on a
 *      missing index — but the app always also filters status == "active", and
 *      THAT combination is indexed. A conformance test that invents its own
 *      query shape tests the index catalogue, not the adapter.
 *
 *   2. Writes must go somewhere firestore.rules actually permits. Firestore
 *      denies by default, so a scratch collection invented for testing is
 *      denied for every operation. Writes here go to eventLabels — the
 *      lightest collection a manager fully owns (create/update/delete, no
 *      field validation) — under a distinctive name prefix, and are swept up
 *      afterwards.
 *
 *   3. Document IDs wrapped in double underscores are RESERVED. "Does a
 *      missing document report exists() === false" needs an id that is merely
 *      absent, not illegal.
 *
 * It is wired into the UI rather than left as a script because the thing worth
 * checking is the deployed bundle, not a Node process.
 *
 * NOTE: this deliberately imports lib/db directly, which
 * tools/check-layering.sh forbids for anything under ../../src outside
 * services/. That guard scans `find src` from the repo root and does not
 * descend into web/, and this file is the shim's own test — the one place that
 * is supposed to hold the handle.
 */

export type ConformanceResult = {
	name: string;
	ok: boolean;
	detail: string;
	ms: number;
};

/**
 * Prefix for every document this test creates, so a run interrupted halfway
 * leaves something a later run can recognise and sweep.
 */
const MARKER = "zz_shim_conformance";

async function step(
	name: string,
	fn: () => Promise<string>,
): Promise<ConformanceResult> {
	const started = performance.now();
	try {
		const detail = await fn();
		return { name, ok: true, detail, ms: performance.now() - started };
	} catch (error) {
		return {
			name,
			ok: false,
			detail: error instanceof Error ? error.message : String(error),
			ms: performance.now() - started,
		};
	}
}

/**
 * Labels a single Firestore call so a failure names the operation.
 *
 * Without this, every write test reports the same bare "Missing or insufficient
 * permissions" and there is no way to tell which of six calls produced it. Three
 * debugging rounds were spent guessing between candidates that a label would
 * have separated in one.
 */
async function probe<T>(label: string, fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`at [${label}]: ${message}`);
	}
}

/** Identifies the running bundle — see the note on __BUILD_STAMP__. */
export const BUILD_STAMP = __BUILD_STAMP__;

export function canRunConformance(): boolean {
	return DATABASE_ID !== "(default)";
}

/** A throwaway label document. Shaped like libraryService.saveEventLabel's. */
function scratchLabel(companyId: string, suffix: string) {
	const ref = db.collection(C.eventLabels).doc();
	return {
		ref,
		seed: {
			id: ref.id,
			companyId,
			name: `${MARKER}_${suffix}`,
			color: "#6B8A2E",
			schemaVersion: 2,
			createdAt: firestore.FieldValue.serverTimestamp(),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		},
	};
}

/**
 * Whether a label document still exists.
 *
 * ON THIS COLLECTION YOU CANNOT ASK ABOUT A DELETED DOCUMENT BY ID — in any
 * form. eventLabels' read rule is `v2IsMember(resource.data.companyId)`; for a
 * document that does not exist `resource` is null, so the rule errors and the
 * result is permission-denied rather than not-found. That applies to:
 *
 *   ref.get()                                 — a direct read
 *   where(documentId(), "in", [id])           — a KEYED LOOKUP, not a scan
 *
 * The second one is the trap, and it cost three debugging rounds. It looks like
 * an ordinary query, so it looks like it should return an empty result set for
 * a missing document. It does not: naming a document id makes Firestore
 * evaluate the rule against that exact path, with the same null `resource`.
 * Adding a companyId filter alongside it does not help, because the filter was
 * never what was missing.
 *
 * The proof sits in this very file: the "FieldPath.documentId() in a
 * where(...)" check above uses the identical call shape against an EXISTING
 * company and passes. Existence is the variable, not the query.
 *
 * So this scans by companyId — a real collection query, where a deleted
 * document is simply absent from the results — and looks for the id in what
 * comes back. Exactly the shape sweep() uses, which has passed every run.
 *
 * (`companies` has none of this trouble: its read rule is `isSignedIn()`, which
 * never touches `resource`, which is why the missing-document check above can
 * use a plain get().)
 */
async function stillExists(companyId: string, id: string): Promise<boolean> {
	const all = await db
		.collection(C.eventLabels)
		.where("companyId", "==", companyId)
		.limit(200)
		.get();
	return all.docs.some((doc) => doc.id === id);
}

/** Deletes anything this test left behind, from this run or an earlier one. */
async function sweep(companyId: string): Promise<number> {
	const all = await db
		.collection(C.eventLabels)
		.where("companyId", "==", companyId)
		.limit(200)
		.get();

	const stale = all.docs.filter((d) =>
		String(d.data()?.name ?? "").startsWith(MARKER),
	);
	if (!stale.length) return 0;

	const batch = db.batch();
	for (const doc of stale) batch.delete(doc.ref);
	await batch.commit();
	return stale.length;
}

/**
 * @param companyId a company the signed-in user MANAGES — reads are scoped to
 *                  it and writes rely on v2IsManager(companyId).
 */
export async function runShimConformance(
	companyId: string,
): Promise<ConformanceResult[]> {
	if (!canRunConformance()) {
		return [
			{
				name: "guard",
				ok: false,
				detail:
					"Refusing to run against the production database. " +
					`Current database is ${DATABASE_LABEL}.`,
				ms: 0,
			},
		];
	}

	const results: ConformanceResult[] = [];

	results.push(
		await step("sweep leftovers from any earlier run", async () => {
			const removed = await sweep(companyId);
			return removed
				? `${removed} stale doc(s) removed`
				: "nothing stale";
		}),
	);

	/* ---------------------------------------------------------- reads */

	results.push(
		await step(
			"collection → where ×2 → orderBy → limit → get",
			async () => {
				// EXACTLY membershipService.subscribeMembers' query. Dropping the
				// status clause changes the index this needs.
				const snapshot = await db
					.collection(C.memberships)
					.where("companyId", "==", companyId)
					.where("status", "==", "active")
					.orderBy("lastName")
					.limit(5)
					.get();
				return `${snapshot.size} docs, empty=${snapshot.empty}`;
			},
		),
	);

	results.push(
		await step(
			"QuerySnapshot.docs / .forEach / doc.id / doc.data",
			async () => {
				const snapshot = await db
					.collection(C.memberships)
					.where("companyId", "==", companyId)
					.limit(3)
					.get();
				let seen = 0;
				snapshot.forEach((d) => {
					if (d.id && d.data()) seen++;
				});
				return `${seen} of ${snapshot.docs.length} readable`;
			},
		),
	);

	results.push(
		await step("exists() === false on a missing document", async () => {
			// A plausible, ABSENT id. Ids wrapped in double underscores are
			// reserved and fail as invalid rather than as missing.
			const snapshot = await db
				.collection(C.companies)
				.doc("no-such-company-9f3a2b7c")
				.get();

			const value = snapshot.exists();
			if (typeof value !== "boolean") {
				throw new Error(
					`exists() returned ${typeof value}, not a boolean — ` +
						"the adapter is exposing it as a property, not a method",
				);
			}
			if (value) throw new Error("a missing document reported true");
			return "false, and it is a method";
		}),
	);

	results.push(
		await step("exists() === true on a real document", async () => {
			const snapshot = await db
				.collection(C.companies)
				.doc(companyId)
				.get();
			if (!snapshot.exists()) {
				throw new Error(`company ${companyId} not found`);
			}
			return `id=${snapshot.id}`;
		}),
	);

	results.push(
		await step(
			"FieldPath.documentId() in a where(..., 'in', ...)",
			async () => {
				const snapshot = await db
					.collection(C.companies)
					.where(firestore.FieldPath.documentId(), "in", [companyId])
					.limit(1)
					.get();
				return `${snapshot.size} doc(s)`;
			},
		),
	);

	results.push(
		await step("range where + orderBy on the same field", async () => {
			// timeEntryService.buildEntryQuery's shape — the combination most
			// likely to need a composite index.
			const snapshot = await db
				.collection(C.timeEntries)
				.where("companyId", "==", companyId)
				.where("dateKey", ">=", "2000-01-01")
				.where("dateKey", "<=", "2099-12-31")
				.orderBy("dateKey", "desc")
				.limit(5)
				.get();
			return `${snapshot.size} entries`;
		}),
	);

	results.push(
		await step("startAfter round-trip through a cursor", async () => {
			const page = (cursor?: unknown) => {
				let q = db
					.collection(C.memberships)
					.where("companyId", "==", companyId)
					.where("status", "==", "active")
					.orderBy("lastName")
					.limit(1);
				if (cursor) q = q.startAfter(cursor);
				return q.get();
			};

			const first = await page();
			if (!first.docs.length) return "skipped — no active memberships";

			// The cursor is the wrapped DocSnap the services pass around;
			// Q.startAfter has to unwrap it.
			const second = await page(first.docs[0]);
			const advanced =
				!second.docs.length || second.docs[0].id !== first.docs[0].id;
			if (!advanced) throw new Error("page 2 repeated page 1");
			return `page 2 returned ${second.size}, cursor advanced`;
		}),
	);

	/* ------------------------------------------------------ listeners */

	results.push(
		await step("onSnapshot(next, error) on a query", async () => {
			return await new Promise<string>((resolve, reject) => {
				const timer = setTimeout(
					() => reject(new Error("no snapshot within 8s")),
					8000,
				);
				const unsubscribe = db
					.collection(C.memberships)
					.where("companyId", "==", companyId)
					.limit(2)
					.onSnapshot(
						(snapshot) => {
							clearTimeout(timer);
							unsubscribe();
							resolve(
								`${snapshot.size} docs; unsubscribe is a fn`,
							);
						},
						(error) => {
							clearTimeout(timer);
							reject(error);
						},
					);
			});
		}),
	);

	results.push(
		await step("onSnapshot on a document reference", async () => {
			return await new Promise<string>((resolve, reject) => {
				const timer = setTimeout(
					() => reject(new Error("no snapshot within 8s")),
					8000,
				);
				const unsubscribe = db
					.collection(C.companies)
					.doc(companyId)
					.onSnapshot(
						(snapshot) => {
							clearTimeout(timer);
							unsubscribe();
							resolve(`exists=${snapshot.exists()}`);
						},
						(error) => {
							clearTimeout(timer);
							reject(error);
						},
					);
			});
		}),
	);

	/* --------------------------------------------------------- writes */

	results.push(
		await step("doc() auto-id → set → get → update → delete", async () => {
			const { ref, seed } = scratchLabel(companyId, "crud");
			if (!ref.id) throw new Error("auto-id was empty");

			await probe("ref.set", () => ref.set({ ...seed, counter: 1 }));

			const afterSet = await probe("ref.get after set", () => ref.get());
			if (!afterSet.exists()) throw new Error("missing after set()");

			await probe("ref.update with increment", () =>
				ref.update({ counter: firestore.FieldValue.increment(2) }),
			);

			const counter = (
				await probe("ref.get after update", () => ref.get())
			).data()?.counter;
			if (counter !== 3)
				throw new Error(`increment gave ${counter}, want 3`);

			await probe("ref.delete", () => ref.delete());

			const survived = await probe("stillExists query", () =>
				stillExists(companyId, ref.id),
			);
			if (survived) throw new Error("document survived delete()");

			return `id=${ref.id}, increment ok, deleted`;
		}),
	);

	results.push(
		await step("set with { merge } and { mergeFields }", async () => {
			const { ref, seed } = scratchLabel(companyId, "merge");
			await ref.set({ ...seed, probe: { keep: "yes", drop: "no" } });
			await ref.set({ extra: 2 }, { merge: true });

			// The shape eventChecklistService uses to tick one checklist item
			// without disturbing its siblings.
			await ref.set(
				{ probe: { drop: "changed" }, ignored: "must not persist" },
				{ mergeFields: ["probe.drop"] },
			);

			const data = (await ref.get()).data() ?? {};
			await ref.delete();

			if (data.name !== seed.name) throw new Error("merge lost a field");
			if (data.extra !== 2)
				throw new Error("merge did not add the field");
			if (data.probe?.keep !== "yes") {
				throw new Error("mergeFields clobbered a sibling");
			}
			if (data.probe?.drop !== "changed") {
				throw new Error("mergeFields did not write its target");
			}
			if ("ignored" in data) {
				throw new Error("mergeFields wrote outside its field list");
			}
			return "merge and mergeFields both scoped correctly";
		}),
	);

	results.push(
		await step("arrayUnion / arrayRemove", async () => {
			const { ref, seed } = scratchLabel(companyId, "array");
			await ref.set({ ...seed, tags: [] });
			await ref.update({
				tags: firestore.FieldValue.arrayUnion("x", "y"),
			});
			await ref.update({ tags: firestore.FieldValue.arrayRemove("x") });

			const tags = (await ref.get()).data()?.tags ?? [];
			await ref.delete();

			if (tags.length !== 1 || tags[0] !== "y") {
				throw new Error(
					`tags ended as ${JSON.stringify(tags)}, want ["y"]`,
				);
			}
			return 'tags === ["y"]';
		}),
	);

	results.push(
		await step("Timestamp.fromDate → toDate / toMillis", async () => {
			const source = new Date("2026-03-12T18:00:00.000Z");
			const { ref, seed } = scratchLabel(companyId, "timestamp");
			await ref.set({
				...seed,
				at: firestore.Timestamp.fromDate(source),
			});

			const stored = (await ref.get()).data()?.at;
			await ref.delete();

			if (typeof stored?.toDate !== "function") {
				throw new Error("stored value has no toDate()");
			}
			if (stored.toMillis() !== source.getTime()) {
				throw new Error(
					`round-trip drifted: ${stored.toMillis()} vs ${source.getTime()}`,
				);
			}
			return stored.toDate().toISOString();
		}),
	);

	results.push(
		await step("batch: set + update + delete + commit", async () => {
			const created = scratchLabel(companyId, "batch_set");
			const patched = scratchLabel(companyId, "batch_update");
			const removed = scratchLabel(companyId, "batch_delete");

			await probe("seed patched.set", () =>
				patched.ref.set({ ...patched.seed, n: 1 }),
			);
			await probe("seed removed.set", () =>
				removed.ref.set(removed.seed),
			);

			const batch = db.batch();
			batch.set(created.ref, { ...created.seed, n: 1 });
			batch.update(patched.ref, { n: 2 });
			batch.delete(removed.ref);
			await probe("batch.commit", () => batch.commit());

			const a = await probe("created.get", () => created.ref.get());
			const b = await probe("patched.get", () => patched.ref.get());
			const removedGone = !(await probe("stillExists query", () =>
				stillExists(companyId, removed.ref.id),
			));
			const outcome = {
				set: a.exists(),
				update: b.data()?.n,
				deleted: removedGone,
			};

			await probe("cleanup deletes", () =>
				Promise.all([created.ref.delete(), patched.ref.delete()]),
			);

			if (!outcome.set || outcome.update !== 2 || !outcome.deleted) {
				throw new Error(`batch outcome ${JSON.stringify(outcome)}`);
			}
			return "all three ops committed";
		}),
	);

	results.push(
		await step("batch.delete(doc.ref) from a query snapshot", async () => {
			// The cascade shape eventService.deleteEvent and
			// timeEntryService.deleteTimeEntry both use.
			const sweepName = `${MARKER}_cascade`;
			const a = scratchLabel(companyId, "cascade");
			const b = scratchLabel(companyId, "cascade");
			await probe("seed two labels", () =>
				Promise.all([a.ref.set(a.seed), b.ref.set(b.seed)]),
			);

			const found = (
				await probe("query by companyId", () =>
					db
						.collection(C.eventLabels)
						.where("companyId", "==", companyId)
						.limit(200)
						.get(),
				)
			).docs.filter((d) => d.data()?.name === sweepName);

			if (found.length < 2) {
				throw new Error(
					`expected 2 seeded docs, found ${found.length}`,
				);
			}

			const batch = db.batch();
			for (const doc of found) batch.delete(doc.ref);
			await probe("batch.commit of doc.ref deletes", () =>
				batch.commit(),
			);

			const survivors = await probe("stillExists queries", () =>
				Promise.all([
					stillExists(companyId, a.ref.id),
					stillExists(companyId, b.ref.id),
				]),
			);
			if (survivors.some(Boolean)) {
				throw new Error("a document survived the cascade");
			}
			return `${found.length} deleted via doc.ref`;
		}),
	);

	results.push(
		await step("query.count().get() aggregate", async () => {
			/*
			 * The counter behind useCalendarEvents' "N events upcoming". A
			 * different modular entry point (getCountFromServer) than every
			 * other read, wrapped to look like RNFirebase's two-step
			 * `count().get()` — so nothing else in the suite exercises it.
			 */
			const a = scratchLabel(companyId, "count");
			const b = scratchLabel(companyId, "count");
			await probe("seed two labels", () =>
				Promise.all([a.ref.set(a.seed), b.ref.set(b.seed)]),
			);

			const scoped = db
				.collection(C.eventLabels)
				.where("companyId", "==", companyId);

			const total = (
				await probe("count().get()", () => scoped.count().get())
			).data().count;

			if (typeof total !== "number") {
				throw new Error(`count returned ${typeof total}, not a number`);
			}
			if (total < 2) {
				throw new Error(`count said ${total}, but 2 were just seeded`);
			}

			/*
			 * Firestore APPLIES limit() to an aggregation. eventService relies
			 * on that being true — it builds the count query WITHOUT the page
			 * limit precisely so the total is not capped at one page.
			 */
			const capped = (
				await probe("count() honours limit", () =>
					scoped.limit(1).count().get(),
				)
			).data().count;
			if (capped !== 1) {
				throw new Error(
					`limit(1).count() returned ${capped}, expected 1 — ` +
						"eventService.buildCountQuery assumes limits apply",
				);
			}

			await probe("cleanup deletes", () =>
				Promise.all([a.ref.delete(), b.ref.delete()]),
			);
			return `counted ${total}, limit respected`;
		}),
	);

	results.push(
		await step("runTransaction: get + set + update + delete", async () => {
			const target = scratchLabel(companyId, "tx_target");
			const doomed = scratchLabel(companyId, "tx_doomed");
			await target.ref.set({ ...target.seed, n: 1 });
			await doomed.ref.set(doomed.seed);

			const returned = await db.runTransaction(async (tx) => {
				const snapshot = await tx.get(target.ref);
				if (!snapshot.exists()) throw new Error("tx.get found nothing");
				const current = snapshot.data()?.n ?? 0;
				tx.update(target.ref, { n: current + 1 });
				tx.delete(doomed.ref);
				return current;
			});

			const after = (await target.ref.get()).data()?.n;
			await target.ref.delete();

			if (returned !== 1)
				throw new Error(`tx returned ${returned}, want 1`);
			if (after !== 2) throw new Error(`tx left n=${after}, want 2`);
			return "read-modify-write and delete both applied";
		}),
	);

	results.push(
		await step("transaction rollback on throw", async () => {
			// groupService.setGroupJoinCode depends on this: a collision throws
			// so the transaction commits nothing and the retry loop continues.
			const { ref, seed } = scratchLabel(companyId, "rollback");
			await ref.set({ ...seed, n: 1 });

			let threw = false;
			try {
				await db.runTransaction(async (tx) => {
					tx.update(ref, { n: 99 });
					throw new Error("CODE_TAKEN");
				});
			} catch (error) {
				threw = (error as Error).message === "CODE_TAKEN";
			}

			const after = (await ref.get()).data()?.n;
			await ref.delete();

			if (!threw) throw new Error("the thrown error did not propagate");
			if (after !== 1)
				throw new Error(`a write leaked through: n=${after}`);
			return "threw, and committed nothing";
		}),
	);

	results.push(
		await step("subcollection via docRef.collection()", async () => {
			// timeEntries/{id}/edits is the only subcollection in the schema.
			// Reading it exercises docRef.collection() path construction;
			// writing an edit needs a real entry, which this test will not
			// manufacture.
			const entries = await db
				.collection(C.timeEntries)
				.where("companyId", "==", companyId)
				.limit(1)
				.get();

			if (!entries.docs.length) return "skipped — no time entries";

			const entryRef = entries.docs[0].ref;
			const edits = await entryRef.collection(C.edits).limit(5).get();
			return `${entryRef.id}/${C.edits} → ${edits.size} doc(s)`;
		}),
	);

	results.push(
		await step("final sweep", async () => {
			const removed = await sweep(companyId);
			return removed
				? `${removed} doc(s) cleaned up`
				: "nothing left behind";
		}),
	);

	return results;
}
