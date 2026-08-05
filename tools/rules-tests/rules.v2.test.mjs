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
/** A 1099 contractor: visibility "restricted", in the Bartenders group. */
const DAN = "dan";
/*
 * A plain, open, ungrouped worker.
 *
 * Deliberately NOT Carl: an earlier test promotes Carl to manager, so every
 * later "a worker cannot..." assertion against him passes through the manager
 * branch and proves nothing. Erin's role is never mutated.
 */
const ERIN = "erin";
/** Invited to one job by name, belonging to no group. */
const FRANK = "frank";

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

		// --- worker groups ------------------------------------------------
		// Dan is a 1099 contractor: restricted, and in the Bartenders group.
		// Erin stays open and ungrouped, which is what every migrated worker
		// looks like.
		await setDoc(doc(db, "groups", "g1"), {
			id: "g1",
			companyId: A,
			name: "Bartenders",
		});
		await setDoc(doc(db, "memberships", mid(A, DAN)), {
			id: mid(A, DAN),
			companyId: A,
			userId: DAN,
			role: "user",
			status: "active",
			visibility: "restricted",
			groupIds: ["g1"],
			firstName: DAN,
			lastName: DAN,
			email: `${DAN}@e.com`,
		});
		await setDoc(doc(db, "users", DAN), { id: DAN, email: `${DAN}@e.com` });

		await setDoc(doc(db, "memberships", mid(A, ERIN)), {
			id: mid(A, ERIN),
			companyId: A,
			userId: ERIN,
			role: "user",
			status: "active",
			visibility: "open",
			groupIds: [],
			firstName: ERIN,
			lastName: ERIN,
			email: `${ERIN}@e.com`,
		});
		await setDoc(doc(db, "users", ERIN), {
			id: ERIN,
			email: `${ERIN}@e.com`,
		});

		// Open to the whole company — the shape every migrated event has.
		await setDoc(doc(db, "events", "eOpen"), {
			id: "eOpen",
			companyId: A,
			title: "Open shift",
			dateKey: "2027-01-10",
			assignedUserIds: [],
			assignedCount: 0,
			audienceGroupIds: [],
			isTargeted: false,
		});
		// Published to Bartenders. Dan holds the invitation; Erin does not.
		await setDoc(doc(db, "events", "eTargeted"), {
			id: "eTargeted",
			companyId: A,
			title: "Contractor shift",
			dateKey: "2027-01-11",
			assignedUserIds: [],
			assignedCount: 0,
			audienceGroupIds: ["g1"],
			isTargeted: true,
		});
		await setDoc(doc(db, "eventResponses", `eTargeted_${DAN}`), {
			id: `eTargeted_${DAN}`,
			companyId: A,
			eventId: "eTargeted",
			userId: DAN,
			dateKey: "2027-01-11",
			status: "pending",
			respondedAt: null,
		});
		// Targeted AND staffed — Erin is on it without ever being invited.
		await setDoc(doc(db, "events", "eTargetedStaffed"), {
			id: "eTargetedStaffed",
			companyId: A,
			title: "Already staffed",
			dateKey: "2027-01-12",
			assignedUserIds: [ERIN],
			assignedCount: 1,
			audienceGroupIds: ["g1"],
			isTargeted: true,
		});
		// Targeted at ONE NAMED PERSON with no group involved. Frank holds the
		// invitation; nobody else does.
		await setDoc(doc(db, "memberships", mid(A, FRANK)), {
			id: mid(A, FRANK),
			companyId: A,
			userId: FRANK,
			role: "user",
			status: "active",
			visibility: "restricted",
			groupIds: [],
			firstName: FRANK,
			lastName: FRANK,
			email: `${FRANK}@e.com`,
		});
		await setDoc(doc(db, "users", FRANK), {
			id: FRANK,
			email: `${FRANK}@e.com`,
		});
		await setDoc(doc(db, "events", "ePerson"), {
			id: "ePerson",
			companyId: A,
			title: "One named bartender",
			dateKey: "2027-01-14",
			assignedUserIds: [],
			assignedCount: 0,
			audienceGroupIds: [],
			audienceUserIds: [FRANK],
			isTargeted: true,
		});
		await setDoc(doc(db, "eventResponses", `ePerson_${FRANK}`), {
			id: `ePerson_${FRANK}`,
			companyId: A,
			eventId: "ePerson",
			userId: FRANK,
			dateKey: "2027-01-14",
			status: "pending",
			respondedAt: null,
		});

		// A join code for the Bartenders group. The document id IS the code.
		await setDoc(doc(db, "groupJoinCodes", "BARTEND1"), {
			code: "BARTEND1",
			companyId: A,
			groupId: "g1",
			visibility: "restricted",
		});

		// No isTargeted field at all — a v2 document written before targeting
		// existed. Must read as open, not deny.
		await setDoc(doc(db, "events", "eLegacy"), {
			id: "eLegacy",
			companyId: A,
			title: "Pre-targeting",
			dateKey: "2027-01-13",
			assignedUserIds: [],
			assignedCount: 0,
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
		// Merge, matching what setEventResponse actually issues. A worker may
		// only move their own answer, so a full replacement that drops `id`
		// would — correctly — be refused.
		await assertSucceeds(
			setDoc(
				doc(as(BOB), "eventResponses", "e1_bob"),
				{
					id: "e1_bob",
					companyId: A,
					eventId: "e1",
					userId: BOB,
					status: "confirmed",
				},
				{ merge: true },
			),
		);
	});

	test("a worker cannot repoint their own response at another event", async () => {
		// The response id is what ties an answer to an invitation. Letting the
		// eventId move would let a worker answer a job they were never offered
		// using a document they legitimately own.
		await assertFails(
			updateDoc(doc(as(BOB), "eventResponses", "e1_bob"), {
				eventId: "eTargeted",
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

describe("v2 — worker groups gate who can answer a job", () => {
	test("an open worker still answers an open job, exactly as before", async () => {
		// The regression test for the whole feature: nothing changes for the
		// W2 staff who make up every migrated membership.
		await assertSucceeds(
			setDoc(doc(as(ERIN), "eventResponses", `eOpen_${ERIN}`), {
				id: `eOpen_${ERIN}`,
				companyId: A,
				eventId: "eOpen",
				userId: ERIN,
				dateKey: "2027-01-10",
				status: "confirmed",
			}),
		);
	});

	test("an event with no isTargeted field reads as open, not denied", async () => {
		// Reading a missing map key raises an error in rules, which denies
		// rather than falls through. Any v2 document written before targeting
		// existed would otherwise become unanswerable.
		await assertSucceeds(
			setDoc(doc(as(ERIN), "eventResponses", `eLegacy_${ERIN}`), {
				id: `eLegacy_${ERIN}`,
				companyId: A,
				eventId: "eLegacy",
				userId: ERIN,
				dateKey: "2027-01-13",
				status: "confirmed",
			}),
		);
	});

	test("an uninvited worker CANNOT opt themselves into a targeted job", async () => {
		// The load-bearing assertion. Without the create/update split a worker
		// simply writes their own response document and the group becomes a
		// suggestion rather than a boundary.
		await assertFails(
			setDoc(doc(as(ERIN), "eventResponses", `eTargeted_${ERIN}`), {
				id: `eTargeted_${ERIN}`,
				companyId: A,
				eventId: "eTargeted",
				userId: ERIN,
				dateKey: "2027-01-11",
				status: "confirmed",
			}),
		);
	});

	test("an invited worker answers their invitation", async () => {
		await assertSucceeds(
			updateDoc(doc(as(DAN), "eventResponses", `eTargeted_${DAN}`), {
				status: "confirmed",
			}),
		);
	});

	test("a manager invites a worker by creating the response", async () => {
		await assertSucceeds(
			setDoc(doc(as(ALICE), "eventResponses", `eTargeted_${ERIN}`), {
				id: `eTargeted_${ERIN}`,
				companyId: A,
				eventId: "eTargeted",
				userId: ERIN,
				dateKey: "2027-01-11",
				status: "pending",
			}),
		);
	});

	test("an uninvited worker cannot even read the targeted job", async () => {
		await assertFails(getDoc(doc(as(BOB), "events", "eTargeted")));
	});

	test("the invited worker can", async () => {
		await assertSucceeds(getDoc(doc(as(DAN), "events", "eTargeted")));
	});

	test("so can a manager, who has to be able to edit it", async () => {
		await assertSucceeds(getDoc(doc(as(ALICE), "events", "eTargeted")));
	});

	test("and so can someone assigned to it without an invitation", async () => {
		// Staffing an event directly skips the availability round trip, so the
		// assignee never gets a response document.
		await assertSucceeds(
			getDoc(doc(as(ERIN), "events", "eTargetedStaffed")),
		);
	});

	test("a job can target one named person with no group at all", async () => {
		await assertSucceeds(
			updateDoc(doc(as(FRANK), "eventResponses", `ePerson_${FRANK}`), {
				status: "confirmed",
			}),
		);
		await assertSucceeds(getDoc(doc(as(FRANK), "events", "ePerson")));
	});

	test("...and nobody else can see or answer it", async () => {
		// Belonging to the targeted GROUP is not the mechanism — holding an
		// invitation is. Dan is in Bartenders and still has no business here.
		await assertFails(getDoc(doc(as(DAN), "events", "ePerson")));
		await assertFails(
			setDoc(doc(as(DAN), "eventResponses", `ePerson_${DAN}`), {
				id: `ePerson_${DAN}`,
				companyId: A,
				eventId: "ePerson",
				userId: DAN,
				dateKey: "2027-01-14",
				status: "confirmed",
			}),
		);
	});

	test("a targeted job in another company is still invisible", async () => {
		await assertFails(getDoc(doc(as(MALLORY), "events", "eTargeted")));
	});
});

describe("v2 — a worker cannot widen their own audience", () => {
	test("no self-promotion out of restricted", async () => {
		await assertFails(
			updateDoc(doc(as(DAN), "memberships", mid(A, DAN)), {
				visibility: "open",
			}),
		);
	});

	test("no adding yourself to a group", async () => {
		await assertFails(
			updateDoc(doc(as(ERIN), "memberships", mid(A, ERIN)), {
				groupIds: ["g1"],
			}),
		);
	});

	test("a manager can do both", async () => {
		await assertSucceeds(
			updateDoc(doc(as(ALICE), "memberships", mid(A, ERIN)), {
				visibility: "restricted",
				groupIds: ["g1"],
			}),
		);
	});

	test("joining a company cannot smuggle in a group", async () => {
		// Membership create is self-service via access code, so the audience
		// fields have to be pinned there too — otherwise a restricted worker
		// rejoins and hands themselves an audience.
		await assertFails(
			setDoc(doc(as(MALLORY), "memberships", mid(A, MALLORY)), {
				id: mid(A, MALLORY),
				companyId: A,
				userId: MALLORY,
				role: "user",
				status: "active",
				visibility: "open",
				groupIds: ["g1"],
			}),
		);
	});
});

describe("v2 — reproducing the signup permission-denied", () => {
	test("a brand-new user can READ the membership they do not have yet", async () => {
		// joinCompanyWithAccessCode runs in a transaction that first reads
		// memberships/{companyId}_{userId} to check for an existing one. On a
		// first join that document does not exist, and a rule phrased in terms
		// of resource.data has nothing to evaluate.
		await assertSucceeds(
			getDoc(doc(as("brandnew"), "memberships", mid(A, "brandnew"))),
		);
	});
});

describe("v2 — same bug class: reads of documents that may not exist", () => {
	test("checklist state for an event nobody has ticked yet", async () => {
		// eventChecklistStates/{eventId} is only written on the first tap, so
		// opening the checklist screen on a fresh event reads a document that
		// is not there.
		await assertSucceeds(
			getDoc(doc(as(BOB), "eventChecklistStates", "eOpen")),
		);
	});

	test("an event that does not exist", async () => {
		await assertSucceeds(getDoc(doc(as(BOB), "events", "nosuchevent")));
	});

	test("a time entry that does not exist", async () => {
		await assertSucceeds(
			getDoc(doc(as(BOB), "timeEntries", "nosuchentry")),
		);
	});

	test("company preferences before any have been saved", async () => {
		await assertSucceeds(getDoc(doc(as(BOB), "companyPreferences", A)));
	});
});

describe("v2 — group join codes", () => {
	const JOINER = "joiner";

	test("a code puts the joiner in exactly that group", async () => {
		await assertSucceeds(
			setDoc(doc(as(JOINER), "memberships", mid(A, JOINER)), {
				id: mid(A, JOINER),
				companyId: A,
				userId: JOINER,
				role: "user",
				status: "active",
				visibility: "restricted",
				groupIds: ["g1"],
				joinedViaCode: "BARTEND1",
			}),
		);
	});

	test("a plain join with no code still works, ungrouped", async () => {
		await assertSucceeds(
			setDoc(doc(as("plain"), "memberships", mid(A, "plain")), {
				id: mid(A, "plain"),
				companyId: A,
				userId: "plain",
				role: "user",
				status: "active",
				visibility: "open",
				groupIds: [],
			}),
		);
	});

	test("naming a group WITHOUT its code is refused", async () => {
		// The guard that matters. Group ids are readable by any member, so
		// without this a joiner simply writes the id they want.
		await assertFails(
			setDoc(doc(as("sneak1"), "memberships", mid(A, "sneak1")), {
				id: mid(A, "sneak1"),
				companyId: A,
				userId: "sneak1",
				role: "user",
				status: "active",
				visibility: "restricted",
				groupIds: ["g1"],
			}),
		);
	});

	test("a made-up code is refused", async () => {
		await assertFails(
			setDoc(doc(as("sneak2"), "memberships", mid(A, "sneak2")), {
				id: mid(A, "sneak2"),
				companyId: A,
				userId: "sneak2",
				role: "user",
				status: "active",
				visibility: "restricted",
				groupIds: ["g1"],
				joinedViaCode: "NOPENOPE",
			}),
		);
	});

	test("a real code cannot be pointed at a DIFFERENT group", async () => {
		await assertFails(
			setDoc(doc(as("sneak3"), "memberships", mid(A, "sneak3")), {
				id: mid(A, "sneak3"),
				companyId: A,
				userId: "sneak3",
				role: "user",
				status: "active",
				visibility: "restricted",
				groupIds: ["g3"],
				joinedViaCode: "BARTEND1",
			}),
		);
	});

	test("a code cannot be used to claim extra groups", async () => {
		await assertFails(
			setDoc(doc(as("sneak4"), "memberships", mid(A, "sneak4")), {
				id: mid(A, "sneak4"),
				companyId: A,
				userId: "sneak4",
				role: "user",
				status: "active",
				visibility: "restricted",
				groupIds: ["g1", "g3"],
				joinedViaCode: "BARTEND1",
			}),
		);
	});

	test("a code cannot be used to pick a softer visibility", async () => {
		// The code decides the visibility, not the joiner. Otherwise a
		// contractor lands open and sees every job in the company.
		await assertFails(
			setDoc(doc(as("sneak5"), "memberships", mid(A, "sneak5")), {
				id: mid(A, "sneak5"),
				companyId: A,
				userId: "sneak5",
				role: "user",
				status: "active",
				visibility: "open",
				groupIds: ["g1"],
				joinedViaCode: "BARTEND1",
			}),
		);
	});

	test("a code cannot be replayed against another company", async () => {
		await assertFails(
			setDoc(doc(as("sneak6"), "memberships", mid(B, "sneak6")), {
				id: mid(B, "sneak6"),
				companyId: B,
				userId: "sneak6",
				role: "user",
				status: "active",
				visibility: "restricted",
				groupIds: ["g1"],
				joinedViaCode: "BARTEND1",
			}),
		);
	});

	test("an EXISTING member cannot re-group themselves with a code", async () => {
		// The whole design rests on this: create applies only to a document
		// that does not exist, and removal is a status change rather than a
		// delete, so no current or former member can ever take the join path
		// again. Changing your own groups stays manager-only.
		await assertFails(
			updateDoc(doc(as(ERIN), "memberships", mid(A, ERIN)), {
				groupIds: ["g1"],
				joinedViaCode: "BARTEND1",
			}),
		);
	});

	test("the code collection cannot be enumerated", async () => {
		// Knowing a code is the credential, so being able to list them would
		// hand over every group in every company at once.
		await assertFails(getDocs(collection(as(BOB), "groupJoinCodes")));
	});

	test("but a code you already know can be read", async () => {
		await assertSucceeds(
			getDoc(doc(as(BOB), "groupJoinCodes", "BARTEND1")),
		);
	});

	test("a plain member cannot mint a code", async () => {
		await assertFails(
			setDoc(doc(as(BOB), "groupJoinCodes", "SNEAKY1"), {
				code: "SNEAKY1",
				companyId: A,
				groupId: "g1",
				visibility: "restricted",
			}),
		);
	});

	test("a manager can", async () => {
		await assertSucceeds(
			setDoc(doc(as(ALICE), "groupJoinCodes", "NEWCODE1"), {
				code: "NEWCODE1",
				companyId: A,
				groupId: "g1",
				visibility: "open",
			}),
		);
	});

	test("a manager cannot TAKE OVER another company's code", async () => {
		// The id is the code, so overwriting a code document steals the code.
		// Checking the companyId being written rather than the one already
		// there would have let any manager repoint anyone else's code at their
		// own group.
		await env.withSecurityRulesDisabled(async (ctx) => {
			await setDoc(doc(ctx.firestore(), "groupJoinCodes", "BOTHCODE"), {
				code: "BOTHCODE",
				companyId: B,
				groupId: "gB",
				visibility: "open",
			});
		});

		await assertFails(
			setDoc(doc(as(ALICE), "groupJoinCodes", "BOTHCODE"), {
				code: "BOTHCODE",
				companyId: A,
				groupId: "g1",
				visibility: "restricted",
			}),
		);
	});

	test("...nor move their own code to another company", async () => {
		await assertFails(
			updateDoc(doc(as(ALICE), "groupJoinCodes", "NEWCODE1"), {
				companyId: B,
			}),
		);
	});

	test("a manager can still rotate their OWN code", async () => {
		await assertSucceeds(
			updateDoc(doc(as(ALICE), "groupJoinCodes", "NEWCODE1"), {
				visibility: "restricted",
			}),
		);
	});
});

describe("v2 — groups are manager-owned", () => {
	test("a member reads the groups in their company", async () => {
		await assertSucceeds(
			getDocs(
				query(
					collection(as(BOB), "groups"),
					where("companyId", "==", A),
				),
			),
		);
	});

	test("a plain member cannot create one", async () => {
		await assertFails(
			setDoc(doc(as(BOB), "groups", "g2"), {
				id: "g2",
				companyId: A,
				name: "Invented",
			}),
		);
	});

	test("a manager can", async () => {
		await assertSucceeds(
			setDoc(doc(as(ALICE), "groups", "g3"), {
				id: "g3",
				companyId: A,
				name: "Weekend crew",
			}),
		);
	});

	test("a manager of another company cannot", async () => {
		await assertFails(
			setDoc(doc(as(MALLORY), "groups", "g4"), {
				id: "g4",
				companyId: A,
				name: "Cross-company",
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
