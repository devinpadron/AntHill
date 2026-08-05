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
 * Rules tests for the interim v1 ruleset (firestore.rules).
 *
 * Run from the repo root:  cd tools/rules-tests && npm install && npm test
 * Requires a Java runtime, which the Firestore emulator needs.
 *
 * Fixture: two companies. Alice owns COMPANY_A, Bob is a plain user in it,
 * Mallory belongs to COMPANY_B only, and Dana carries the legacy "Admin"
 * role that dbMigrationUtils never normalized.
 */

const COMPANY_A = "companyA";
const COMPANY_B = "companyB";

const ALICE = "alice"; // owner of A
const BOB = "bob"; // plain user in A — must STAY a plain user
const CARL = "carl"; // plain user in A, promoted by the escalation suite
const MALLORY = "mallory"; // member of B only
const DANA = "dana"; // legacy "Admin" in A

let testEnv;

before(async () => {
	testEnv = await initializeTestEnvironment({
		projectId: "anthill-rules-test",
		firestore: {
			rules: readFileSync("firestore.rules", "utf8"),
			host: "127.0.0.1",
			port: 8080,
		},
	});

	await testEnv.withSecurityRulesDisabled(async (ctx) => {
		const db = ctx.firestore();

		await setDoc(doc(db, "AppData/Data"), { required_version: "1.0.100" });
		await setDoc(doc(db, "appConfig/schema"), {
			activeVersion: 1,
			maintenance: false,
			message: "",
		});

		await setDoc(doc(db, "Companies", COMPANY_A), {
			name: "Company A",
			accessCode: "AAA111",
		});
		await setDoc(doc(db, "Companies", COMPANY_B), {
			name: "Company B",
			accessCode: "BBB222",
		});

		await setDoc(doc(db, "Companies", COMPANY_A, "Users", ALICE), {
			role: "owner",
		});
		await setDoc(doc(db, "Companies", COMPANY_A, "Users", BOB), {
			role: "user",
		});
		await setDoc(doc(db, "Companies", COMPANY_A, "Users", CARL), {
			role: "user",
		});
		await setDoc(doc(db, "Companies", COMPANY_A, "Users", DANA), {
			role: "Admin", // legacy capitalization, still live in production
		});
		await setDoc(doc(db, "Companies", COMPANY_B, "Users", MALLORY), {
			role: "user",
		});

		for (const uid of [ALICE, BOB, CARL, MALLORY, DANA]) {
			await setDoc(doc(db, "Users", uid), {
				firstName: uid,
				email: `${uid}@example.com`,
			});
		}

		await setDoc(doc(db, "Companies", COMPANY_A, "Events", "event1"), {
			title: "Wedding",
			assignedWorkers: [BOB],
			workerStatus: {},
		});
		await setDoc(doc(db, "Companies", COMPANY_A, "Checklists", "cl1"), {
			title: "Setup",
			items: [],
		});
	});
});

after(async () => {
	await testEnv?.cleanup();
});

const unauth = () => testEnv.unauthenticatedContext().firestore();
const as = (uid) => testEnv.authenticatedContext(uid).firestore();

describe("the breach that was live in production", () => {
	test("unauthenticated users cannot read Users", async () => {
		await assertFails(getDoc(doc(unauth(), "Users", ALICE)));
	});

	test("unauthenticated users cannot list Users", async () => {
		await assertFails(getDocs(collection(unauth(), "Users")));
	});

	test("unauthenticated users cannot read company events", async () => {
		await assertFails(
			getDoc(doc(unauth(), "Companies", COMPANY_A, "Events", "event1")),
		);
	});

	// This was assertSucceeds while 1.0.98 was the released build, whose signup
	// read this collection before authenticating. Access codes are what let
	// someone join a company, so leaving them world-readable meant anyone could
	// harvest one without holding an account.
	test("anonymous readers cannot harvest company access codes", async () => {
		await assertFails(getDocs(collection(unauth(), "Companies")));
		await assertFails(getDoc(doc(unauth(), "Companies", COMPANY_A)));
	});

	test("a signed-in user still can, which is how joining works", async () => {
		await assertSucceeds(getDocs(collection(as(BOB), "Companies")));
	});

	test("...but nothing INSIDE a company leaks to anonymous readers", async () => {
		await assertFails(
			getDocs(collection(unauth(), "Companies", COMPANY_A, "Users")),
		);
		await assertFails(
			getDocs(
				collection(unauth(), "Companies", COMPANY_A, "TimeEntries"),
			),
		);
		await assertFails(
			getDoc(
				doc(
					unauth(),
					"Companies",
					COMPANY_A,
					"Settings",
					"preferences",
				),
			),
		);
	});
});

describe("pre-auth launch gate still works", () => {
	test("AppData/Data is readable without signing in", async () => {
		await assertSucceeds(getDoc(doc(unauth(), "AppData/Data")));
	});

	test("appConfig/schema is readable without signing in", async () => {
		await assertSucceeds(getDoc(doc(unauth(), "appConfig/schema")));
	});

	test("nobody can write the gate documents from a client", async () => {
		await assertFails(
			setDoc(doc(as(ALICE), "appConfig/schema"), { maintenance: true }),
		);
		await assertFails(
			setDoc(doc(as(ALICE), "AppData/Data"), {
				required_version: "9.9.9",
			}),
		);
	});
});

describe("signup and joining by access code", () => {
	test("a signed-in user can query Companies by accessCode", async () => {
		// useSignUp creates the auth account first, then runs this query.
		await assertSucceeds(
			getDocs(
				query(
					collection(as("newcomer"), "Companies"),
					where("accessCode", "==", "AAA111"),
				),
			),
		);
	});

	test("a user may create their own membership as a plain user", async () => {
		await assertSucceeds(
			setDoc(
				doc(
					as("newcomer"),
					"Companies",
					COMPANY_A,
					"Users",
					"newcomer",
				),
				{
					role: "user",
				},
			),
		);
	});
});

describe("privilege escalation is blocked", () => {
	test("a user cannot join as an owner", async () => {
		await assertFails(
			setDoc(
				doc(
					as("intruder"),
					"Companies",
					COMPANY_A,
					"Users",
					"intruder",
				),
				{
					role: "owner",
				},
			),
		);
	});

	test("a user cannot promote themselves", async () => {
		await assertFails(
			updateDoc(doc(as(BOB), "Companies", COMPANY_A, "Users", BOB), {
				role: "owner",
			}),
		);
	});

	test("a user cannot create a membership for someone else", async () => {
		await assertFails(
			setDoc(doc(as(BOB), "Companies", COMPANY_A, "Users", "victim"), {
				role: "user",
			}),
		);
	});

	// Promotes CARL, not BOB — this test MUTATES the fixture, and the
	// "admin-authored company config" suite below relies on BOB still being a
	// plain user.
	test("a manager can change another member's role", async () => {
		await assertSucceeds(
			updateDoc(doc(as(ALICE), "Companies", COMPANY_A, "Users", CARL), {
				role: "manager",
			}),
		);
	});

	test("a legacy 'Admin' role still counts as a manager", async () => {
		// dbMigrationUtils never ran, so capitalized roles are still live.
		// Dropping them from the rules would lock existing admins out.
		await assertSucceeds(
			setDoc(doc(as(DANA), "Companies", COMPANY_A, "Checklists", "cl2"), {
				title: "From a legacy admin",
			}),
		);
	});
});

describe("cross-company isolation", () => {
	test("a member of B cannot read A's events", async () => {
		await assertFails(
			getDoc(
				doc(as(MALLORY), "Companies", COMPANY_A, "Events", "event1"),
			),
		);
	});

	test("a member of B cannot write A's events", async () => {
		await assertFails(
			setDoc(
				doc(as(MALLORY), "Companies", COMPANY_A, "Events", "event2"),
				{
					title: "Injected",
				},
			),
		);
	});

	test("a member of B cannot delete A's events", async () => {
		await assertFails(
			deleteDoc(
				doc(as(MALLORY), "Companies", COMPANY_A, "Events", "event1"),
			),
		);
	});

	test("a member of B cannot read A's member list", async () => {
		await assertFails(
			getDocs(collection(as(MALLORY), "Companies", COMPANY_A, "Users")),
		);
	});
});

describe("members can do their job", () => {
	test("a member reads events", async () => {
		await assertSucceeds(
			getDoc(doc(as(BOB), "Companies", COMPANY_A, "Events", "event1")),
		);
	});

	test("a worker records a confirm/decline on an event", async () => {
		// availabilityService writes the workerStatus map on the event doc.
		await assertSucceeds(
			updateDoc(
				doc(as(BOB), "Companies", COMPANY_A, "Events", "event1"),
				{
					workerStatus: { [BOB]: "confirmed" },
				},
			),
		);
	});

	test("a worker ticks an event checklist item", async () => {
		await assertSucceeds(
			setDoc(
				doc(
					as(BOB),
					"Companies",
					COMPANY_A,
					"Events",
					"event1",
					"Checklists",
					"cl1",
				),
				{ item1: 1 },
			),
		);
	});

	test("a member creates their own time entry", async () => {
		await assertSucceeds(
			setDoc(doc(as(BOB), "Companies", COMPANY_A, "TimeEntries", "te1"), {
				userId: BOB,
				status: "active",
			}),
		);
	});
});

describe("admin-authored company config", () => {
	test("a plain member cannot write company checklists", async () => {
		await assertFails(
			setDoc(doc(as(BOB), "Companies", COMPANY_A, "Checklists", "cl3"), {
				title: "Nope",
			}),
		);
	});

	test("a plain member cannot change company preferences", async () => {
		await assertFails(
			setDoc(
				doc(as(BOB), "Companies", COMPANY_A, "Settings", "preferences"),
				{
					enableTimeSheet: false,
				},
			),
		);
	});

	test("a manager can change company preferences", async () => {
		await assertSucceeds(
			setDoc(
				doc(
					as(ALICE),
					"Companies",
					COMPANY_A,
					"Settings",
					"preferences",
				),
				{ enableTimeSheet: true },
			),
		);
	});

	test("nobody can write the company document itself", async () => {
		await assertFails(
			updateDoc(doc(as(ALICE), "Companies", COMPANY_A), {
				accessCode: "HACKED",
			}),
		);
	});
});

describe("user profiles", () => {
	test("a user can write their own profile", async () => {
		await assertSucceeds(
			updateDoc(doc(as(BOB), "Users", BOB), { phone: "555-0100" }),
		);
	});

	test("a user cannot write someone else's profile", async () => {
		await assertFails(
			updateDoc(doc(as(BOB), "Users", ALICE), { phone: "555-0199" }),
		);
	});

	test("a user cannot read someone else's preferences", async () => {
		await assertFails(
			getDoc(doc(as(BOB), "Users", ALICE, "Preferences", "settings")),
		);
	});

	test("a user can read their own preferences", async () => {
		await assertSucceeds(
			getDoc(doc(as(BOB), "Users", BOB, "Preferences", "settings")),
		);
	});
});
