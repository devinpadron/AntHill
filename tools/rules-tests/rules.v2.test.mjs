import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import {
	assertFails,
	assertSucceeds,
	initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	query,
	setDoc,
	updateDoc,
	where,
} from "firebase/firestore";

/*
 * v2 security rules.
 *
 * Fixture mirrors the v1 suite: Alice owns company A, Bob is a plain member,
 * Carl is a second plain member, Mallory belongs to company B only, and Rita
 * has been removed from A (status "removed") — she must be treated as a
 * non-member despite the document existing.
 */

const A = "companyA";
const B = "companyB";

const ALICE = "alice";
const BOB = "bob";
const CARL = "carl";
const MALLORY = "mallory";
const RITA = "rita";

let env;

const mid = (companyId, userId) => `${companyId}_${userId}`;

before(async () => {
	env = await initializeTestEnvironment({
		projectId: "anthill-rules-v2",
		firestore: {
			rules: readFileSync("firestore.rules", "utf8"),
			host: "127.0.0.1",
			port: 8080,
		},
	});

	await env.withSecurityRulesDisabled(async (ctx) => {
		const db = ctx.firestore();

		await setDoc(doc(db, "companies", A), {
			id: A,
			name: "A",
			accessCode: "AAA111",
		});
		await setDoc(doc(db, "companies", B), {
			id: B,
			name: "B",
			accessCode: "BBB222",
		});

		const member = (companyId, userId, role, status = "active") =>
			setDoc(doc(db, "memberships", mid(companyId, userId)), {
				id: mid(companyId, userId),
				companyId,
				userId,
				role,
				status,
				firstName: userId,
				lastName: userId,
				email: `${userId}@e.com`,
			});

		await member(A, ALICE, "owner");
		await member(A, BOB, "user");
		await member(A, CARL, "user");
		await member(A, RITA, "user", "removed");
		await member(B, MALLORY, "user");

		for (const uid of [ALICE, BOB, CARL, MALLORY, RITA]) {
			await setDoc(doc(db, "users", uid), {
				id: uid,
				email: `${uid}@e.com`,
			});
		}

		await setDoc(doc(db, "events", "e1"), {
			id: "e1",
			companyId: A,
			title: "Wedding",
			dateKey: "2025-06-15",
			assignedUserIds: [BOB],
			assignedCount: 1,
			workerNotes: "",
		});
		await setDoc(doc(db, "eventResponses", "e1_bob"), {
			id: "e1_bob",
			companyId: A,
			eventId: "e1",
			userId: BOB,
			status: "pending",
		});
		await setDoc(doc(db, "timeEntries", "t1"), {
			id: "t1",
			companyId: A,
			userId: BOB,
			status: "completed",
		});
		await setDoc(doc(db, "timeEntries", "t1", "connections", "c1"), {
			id: "c1",
			companyId: A,
			entryId: "t1",
			eventId: "e1",
		});
		await setDoc(doc(db, "timeEntries", "t1", "edits", "t1-0001"), {
			id: "t1-0001",
			companyId: A,
			entryId: "t1",
			summary: "second",
		});
		await setDoc(doc(db, "timeEntries", "t1", "edits", "t1-0000"), {
			id: "t1-0000",
			companyId: A,
			entryId: "t1",
			summary: "created",
		});
		await setDoc(doc(db, "formSchemas", "s1"), {
			id: "s1",
			companyId: A,
			kind: "eventForm",
			version: 1,
			fields: [],
		});
		await setDoc(doc(db, "checklists", "cl1"), {
			id: "cl1",
			companyId: A,
			title: "Setup",
		});
		await setDoc(doc(db, "attachments", "a1"), {
			id: "a1",
			companyId: A,
			parentType: "event",
			parentId: "e1",
			ownerUserId: BOB,
		});
	});
});

after(async () => env?.cleanup());

const unauth = () => env.unauthenticatedContext().firestore();
const as = (uid) => env.authenticatedContext(uid).firestore();

describe("v2 — company scoping is enforced, not conventional", () => {
	test("an unscoped query is REJECTED, not silently broadened", async () => {
		// This is the whole argument for flattening. Because rules reference
		// resource.data.companyId, Firestore cannot prove every result would
		// pass, so it rejects the query outright.
		await assertFails(getDocs(collection(as(BOB), "events")));
	});

	test("the same query WITH a companyId filter succeeds", async () => {
		await assertSucceeds(
			getDocs(
				query(
					collection(as(BOB), "events"),
					where("companyId", "==", A),
				),
			),
		);
	});

	test("filtering by someone else's companyId still fails", async () => {
		await assertFails(
			getDocs(
				query(
					collection(as(MALLORY), "events"),
					where("companyId", "==", A),
				),
			),
		);
	});

	test("anonymous readers get nothing", async () => {
		await assertFails(getDoc(doc(unauth(), "events", "e1")));
		await assertFails(getDoc(doc(unauth(), "timeEntries", "t1")));
		await assertFails(getDoc(doc(unauth(), "memberships", mid(A, BOB))));
	});
});

describe("v2 — removed members lose access", () => {
	test("a removed member cannot read events", async () => {
		// The membership document still exists, so exists() alone is not enough:
		// status must be checked or removal would be cosmetic.
		await assertFails(getDoc(doc(as(RITA), "events", "e1")));
	});

	test("an active member can", async () => {
		await assertSucceeds(getDoc(doc(as(BOB), "events", "e1")));
	});
});

describe("v2 — user profiles are self-only", () => {
	test("a member cannot read a colleague's profile", async () => {
		// v1 had to expose every profile to build member lists. v2 denormalizes
		// onto memberships, so this can be locked down.
		await assertFails(getDoc(doc(as(BOB), "users", ALICE)));
	});

	test("but can read their own", async () => {
		await assertSucceeds(getDoc(doc(as(BOB), "users", BOB)));
	});

	test("member lists still work, from memberships", async () => {
		await assertSucceeds(
			getDocs(
				query(
					collection(as(BOB), "memberships"),
					where("companyId", "==", A),
				),
			),
		);
	});
});

describe("v2 — privilege escalation", () => {
	test("a user cannot join as an owner", async () => {
		await assertFails(
			setDoc(doc(as("newcomer"), "memberships", mid(A, "newcomer")), {
				companyId: A,
				userId: "newcomer",
				role: "owner",
				status: "active",
			}),
		);
	});

	test("a user may join as a plain user", async () => {
		await assertSucceeds(
			setDoc(doc(as("newcomer"), "memberships", mid(A, "newcomer")), {
				companyId: A,
				userId: "newcomer",
				role: "user",
				status: "active",
			}),
		);
	});

	test("a membership id must be the canonical composite", async () => {
		// Otherwise a user could write a membership under an id that some other
		// lookup resolves to.
		await assertFails(
			setDoc(doc(as("sneak"), "memberships", "not_the_right_id"), {
				companyId: A,
				userId: "sneak",
				role: "user",
				status: "active",
			}),
		);
	});

	test("a member cannot promote themselves", async () => {
		await assertFails(
			updateDoc(doc(as(BOB), "memberships", mid(A, BOB)), {
				role: "manager",
			}),
		);
	});

	test("a member CAN refresh their own denormalized profile", async () => {
		await assertSucceeds(
			updateDoc(doc(as(BOB), "memberships", mid(A, BOB)), {
				firstName: "Robert",
			}),
		);
	});

	test("...but not while sneaking a role change into the same write", async () => {
		await assertFails(
			updateDoc(doc(as(BOB), "memberships", mid(A, BOB)), {
				firstName: "Robert",
				role: "owner",
			}),
		);
	});

	test("a manager can change roles", async () => {
		await assertSucceeds(
			updateDoc(doc(as(ALICE), "memberships", mid(A, CARL)), {
				role: "manager",
			}),
		);
	});
});

describe("v2 — events", () => {
	test("a plain member cannot create an event", async () => {
		await assertFails(
			setDoc(doc(as(BOB), "events", "e2"), {
				companyId: A,
				title: "Nope",
				dateKey: "2025-07-01",
			}),
		);
	});

	test("a manager can", async () => {
		await assertSucceeds(
			setDoc(doc(as(ALICE), "events", "e3"), {
				companyId: A,
				title: "Yes",
				dateKey: "2025-07-01",
			}),
		);
	});

	test("a worker may edit ONLY their own notes", async () => {
		await assertSucceeds(
			updateDoc(doc(as(BOB), "events", "e1"), {
				workerNotes: "Running late",
			}),
		);
	});

	test("a worker cannot rewrite the event around their note", async () => {
		// v1's saveNotes wrote the whole document back, clobbering admin edits.
		await assertFails(
			updateDoc(doc(as(BOB), "events", "e1"), {
				workerNotes: "x",
				title: "Hijacked",
			}),
		);
	});

	test("a worker cannot reassign an event", async () => {
		await assertFails(
			updateDoc(doc(as(BOB), "events", "e1"), {
				assignedUserIds: [BOB, CARL],
			}),
		);
	});
});

describe("v2 — event responses are per-user", () => {
	test("a worker records their own response", async () => {
		await assertSucceeds(
			setDoc(doc(as(BOB), "eventResponses", "e1_bob"), {
				companyId: A,
				eventId: "e1",
				userId: BOB,
				status: "confirmed",
			}),
		);
	});

	test("a worker CANNOT respond on a colleague's behalf", async () => {
		// Impossible to express with an embedded workerStatus map, because rules
		// can only diff top-level keys. This is the reason responses are their
		// own documents.
		await assertFails(
			setDoc(doc(as(BOB), "eventResponses", "e1_carl"), {
				companyId: A,
				eventId: "e1",
				userId: CARL,
				status: "declined",
			}),
		);
	});

	test("the document id must match event_user", async () => {
		await assertFails(
			setDoc(doc(as(BOB), "eventResponses", "wrong_id"), {
				companyId: A,
				eventId: "e1",
				userId: BOB,
				status: "confirmed",
			}),
		);
	});
});

describe("v2 — time entries", () => {
	test("a worker creates their own entry", async () => {
		await assertSucceeds(
			setDoc(doc(as(BOB), "timeEntries", "t2"), {
				companyId: A,
				userId: BOB,
				status: "active",
			}),
		);
	});

	test("a worker cannot create an entry for someone else", async () => {
		await assertFails(
			setDoc(doc(as(BOB), "timeEntries", "t3"), {
				companyId: A,
				userId: CARL,
				status: "active",
			}),
		);
	});

	test("a manager can approve anyone's entry", async () => {
		await assertSucceeds(
			updateDoc(doc(as(ALICE), "timeEntries", "t1"), {
				status: "approved",
			}),
		);
	});

	test("a member of another company cannot touch it", async () => {
		await assertFails(
			updateDoc(doc(as(MALLORY), "timeEntries", "t1"), {
				status: "approved",
			}),
		);
	});
});

describe("v2 — append-only and immutable records", () => {
	test("edits cannot be rewritten", async () => {
		await assertFails(
			updateDoc(doc(as(ALICE), "timeEntries", "t1", "edits", "t1-0000"), {
				summary: "rewritten history",
			}),
		);
	});

	test("edits cannot be deleted by a plain member", async () => {
		/*
		 * Managers CAN delete edits — see the entry-deletion test below. The
		 * guarantee that matters is that an edit can never be REWRITTEN, which
		 * the test above covers for everyone including owners.
		 */
		await assertFails(
			deleteDoc(doc(as(BOB), "timeEntries", "t1", "edits", "t1-0000")),
		);
	});

	test("a published form schema cannot be mutated", async () => {
		// Historical time entries reference these by id; mutating one would
		// silently rewrite how past submissions render.
		await assertFails(
			updateDoc(doc(as(ALICE), "formSchemas", "s1"), {
				title: "changed",
			}),
		);
	});

	test("a new schema version can be published", async () => {
		await assertSucceeds(
			setDoc(doc(as(ALICE), "formSchemas", "s2"), {
				companyId: A,
				kind: "eventForm",
				version: 2,
				fields: [],
			}),
		);
	});
});

describe("v2 — company library is manager-only", () => {
	test("a plain member cannot write checklists", async () => {
		await assertFails(
			setDoc(doc(as(BOB), "checklists", "cl2"), {
				companyId: A,
				title: "Nope",
			}),
		);
	});

	test("a manager can", async () => {
		await assertSucceeds(
			setDoc(doc(as(ALICE), "checklists", "cl3"), {
				companyId: A,
				title: "Yes",
			}),
		);
	});

	test("preferences are manager-only", async () => {
		await assertFails(
			setDoc(doc(as(BOB), "companyPreferences", A), {
				companyId: A,
				enableTimeSheet: false,
			}),
		);
		await assertSucceeds(
			setDoc(doc(as(ALICE), "companyPreferences", A), {
				companyId: A,
				enableTimeSheet: true,
			}),
		);
	});
});

describe("v2 — attachments", () => {
	test("the owner can delete their own", async () => {
		await assertSucceeds(deleteDoc(doc(as(BOB), "attachments", "a1")));
	});

	test("a member of another company cannot read them", async () => {
		await assertFails(getDoc(doc(as(MALLORY), "attachments", "a1")));
	});
});

describe("v2 — reproducing the ProfilePage failure", () => {
	test("a user can list their OWN memberships across companies", async () => {
		// useProfile.getMembershipsForUser: no companyId filter, because the
		// point is to find every company the user belongs to.
		await assertSucceeds(
			getDocs(
				query(
					collection(as(BOB), "memberships"),
					where("userId", "==", BOB),
					where("status", "==", "active"),
				),
			),
		);
	});
});

describe("v2 — the widened membership read is still scoped", () => {
	test("listing memberships by SOMEONE ELSE's userId is denied", async () => {
		// The new isSelf() clause must not become a way to enumerate a
		// colleague's companies.
		await assertFails(
			getDocs(
				query(
					collection(as(BOB), "memberships"),
					where("userId", "==", ALICE),
					where("status", "==", "active"),
				),
			),
		);
	});

	test("a member of another company still cannot read this company's memberships", async () => {
		await assertFails(
			getDocs(
				query(
					collection(as(MALLORY), "memberships"),
					where("companyId", "==", A),
				),
			),
		);
	});

	test("an unscoped memberships query is still rejected", async () => {
		await assertFails(getDocs(collection(as(BOB), "memberships")));
	});
});

describe("v2 — subcollection LIST queries", () => {
	test("a member can list an entry's edits", async () => {
		// getEdits: orderBy("seq") with no companyId filter, because every edit
		// under an entry belongs to that entry's company by construction.
		await assertSucceeds(
			getDocs(collection(as(BOB), "timeEntries", "t1", "edits")),
		);
	});

	test("a member can list an entry's connections", async () => {
		await assertSucceeds(
			getDocs(collection(as(BOB), "timeEntries", "t1", "connections")),
		);
	});

	test("a member of another company cannot list them", async () => {
		await assertFails(
			getDocs(collection(as(MALLORY), "timeEntries", "t1", "edits")),
		);
	});
});

describe("v2 — remaining unscoped queries from the service sweep", () => {
	test("companies can be queried by accessCode (signup / join)", async () => {
		// The rule is `allow read: if isSignedIn()` — no resource.data
		// reference — so it is statically satisfiable without a companyId
		// filter.
		await assertSucceeds(
			getDocs(
				query(
					collection(as("newcomer2"), "companies"),
					where("accessCode", "==", "AAA111"),
				),
			),
		);
	});

	test("deleting a time entry can also delete its connections", async () => {
		await assertSucceeds(
			deleteDoc(doc(as(ALICE), "timeEntries", "t1", "connections", "c1")),
		);
	});

	test("a manager CAN delete an edit, so entry deletion works", async () => {
		// deleteTimeEntry batches child deletes; if this were forbidden the
		// whole batch would fail and time entries could never be deleted.
		await assertSucceeds(
			deleteDoc(doc(as(ALICE), "timeEntries", "t1", "edits", "t1-0000")),
		);
	});

	test("a plain member cannot delete an edit", async () => {
		await assertFails(
			deleteDoc(doc(as(BOB), "timeEntries", "t1", "edits", "t1-0001")),
		);
	});

	test("nobody can REWRITE an edit — the audit trail is append-only", async () => {
		await assertFails(
			updateDoc(doc(as(ALICE), "timeEntries", "t1", "edits", "t1-0001"), {
				summary: "rewritten",
			}),
		);
	});
});
