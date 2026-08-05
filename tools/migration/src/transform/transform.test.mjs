import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
	normalizeWorkerStatus,
	transformChecklistState,
	transformEvent,
	transformEventResponses,
} from "./event.mjs";
import {
	resolveReview,
	transformConnections,
	transformEdits,
	transformTimeEntry,
} from "./timeEntry.mjs";
import { transformAttachment } from "./attachment.mjs";
import {
	createSchemaRegistry,
	normalizeRole,
	transformMembership,
	transformUser,
} from "./identity.mjs";
import { transformChecklist, transformPackage } from "./library.mjs";

const EASTERN = "America/New_York";
const ctx = (extra = {}) => ({
	companyId: "SoBridalSocial",
	timeZone: EASTERN,
	...extra,
});
const codes = (issues) => issues.map((i) => i.code);

describe("transformEvent", () => {
	test("normal event with offset-ISO times", () => {
		const { doc, issues } = transformEvent(
			"e1",
			{
				title: "Wedding",
				date: "2025-06-15",
				startTime: "2025-06-15T17:00:00-04:00",
				endTime: "2025-06-15T22:00:00-04:00",
				duration: "5.00",
				notes: "admin note",
				userNotes: "worker note",
				assignedWorkers: ["u1", "u2"],
				packages: ["p1"],
				labelId: "l1",
			},
			ctx({ labelIds: new Set(["l1"]), packageIds: new Set(["p1"]) }),
		);

		assert.equal(doc.dateKey, "2025-06-15");
		assert.equal(doc.isAllDay, false);
		assert.equal(doc.durationSeconds, 18000);
		// The two v1 notes fields get names that say who writes them.
		assert.equal(doc.adminNotes, "admin note");
		assert.equal(doc.workerNotes, "worker note");
		assert.equal(doc.assignedCount, 2);
		assert.deepEqual(issues, []);
	});

	test("bare time-of-day resolves against the event date in company zone", () => {
		const { doc, issues } = transformEvent(
			"e2",
			{ date: "2025-06-15", startTime: "17:30", endTime: "21:30" },
			ctx(),
		);
		assert.equal(doc.startAt.toISOString(), "2025-06-15T21:30:00.000Z");
		assert.equal(doc.endAt.toISOString(), "2025-06-16T01:30:00.000Z");
		assert.equal(doc.durationSeconds, 14400);
		assert.ok(codes(issues).includes("ASSUMED_TIMEZONE"));
	});

	test("all-day is an explicit flag, not a null startTime", () => {
		const { doc } = transformEvent(
			"e3",
			{
				date: "2025-06-15",
				startTime: null,
				endTime: null,
				duration: "8.00",
			},
			ctx(),
		);
		assert.equal(doc.isAllDay, true);
		assert.equal(doc.startAt, null);
		assert.equal(doc.durationSeconds, 28800);
	});

	test("assignedCount is always correct, including for empty arrays", () => {
		// v1 queried `assignedWorkers == []`, which missed absent fields.
		const empty = transformEvent(
			"e4",
			{ date: "2025-06-15", assignedWorkers: [] },
			ctx(),
		);
		const absent = transformEvent("e5", { date: "2025-06-15" }, ctx());
		assert.equal(empty.doc.assignedCount, 0);
		assert.equal(absent.doc.assignedCount, 0);
		assert.deepEqual(absent.doc.assignedUserIds, []);
	});

	test("responseCounts covers the availability flow, not just assignees", () => {
		// An unassigned upcoming event collects availability replies BEFORE
		// anyone is assigned. Counting only assignees reported zero for an
		// event with fifteen replies — caught by the golden set, not by any
		// invariant, because the wrong counter was internally consistent.
		const v1 = {
			date: "2027-08-14",
			assignedWorkers: [],
			workerStatus: { u1: "confirmed", u2: "confirmed", u3: "declined" },
		};
		const { doc } = transformEvent("e1", v1, ctx());
		assert.equal(doc.assignedCount, 0);
		assert.deepEqual(doc.responseCounts, {
			confirmed: 2,
			declined: 1,
			pending: 0,
		});
	});

	test("responseCounts always matches the eventResponses emitted", () => {
		const v1 = {
			date: "2025-06-15",
			assignedWorkers: ["u1", "u2"],
			workerStatus: { u1: "confirmed", u9: "declined" },
		};
		const { doc } = transformEvent("e1", v1, ctx());
		const responses = transformEventResponses("e1", v1, ctx());
		const total =
			doc.responseCounts.confirmed +
			doc.responseCounts.declined +
			doc.responseCounts.pending;
		assert.equal(total, responses.length);
	});

	test("dangling label is nulled and reported, not carried over", () => {
		const { doc, issues } = transformEvent(
			"e6",
			{ date: "2025-06-15", labelId: "ghost" },
			ctx({ labelIds: new Set(["l1"]) }),
		);
		assert.equal(doc.labelId, null);
		assert.ok(codes(issues).includes("LABEL_DANGLING"));
	});

	test("assignment to a deleted user is reported but kept", () => {
		// 48 such references exist in production across 4 deleted users.
		const { doc, issues } = transformEvent(
			"e7",
			{ date: "2025-06-15", assignedWorkers: ["ghost"] },
			ctx({ userIds: new Set(["u1"]) }),
		);
		assert.deepEqual(doc.assignedUserIds, ["ghost"]);
		assert.ok(codes(issues).includes("ASSIGNED_USER_MISSING"));
	});

	test("legacy `label` key is honoured when `labelId` is absent", () => {
		const { doc } = transformEvent(
			"e8",
			{ date: "2025-06-15", label: "l1" },
			ctx({ labelIds: new Set(["l1"]) }),
		);
		assert.equal(doc.labelId, "l1");
	});

	test("duplicate assigned workers collapse", () => {
		const { doc } = transformEvent(
			"e9",
			{ date: "2025-06-15", assignedWorkers: ["u1", "u1", "u2"] },
			ctx(),
		);
		assert.deepEqual(doc.assignedUserIds, ["u1", "u2"]);
		assert.equal(doc.assignedCount, 2);
	});
});

describe("workerStatus -> eventResponses", () => {
	test("map form, with absence meaning pending", () => {
		const docs = transformEventResponses(
			"e1",
			{
				date: "2025-06-15",
				assignedWorkers: ["u1", "u2", "u3"],
				workerStatus: { u1: "confirmed", u2: "declined" },
			},
			ctx(),
		);
		assert.equal(docs.length, 3);
		assert.equal(docs.find((d) => d.userId === "u3").status, "pending");
		assert.equal(docs[0].id, "e1_u1");
	});

	test("array form is handled defensively", () => {
		const normalized = normalizeWorkerStatus([
			{ userId: "u1", status: "confirmed" },
		]);
		assert.deepEqual(normalized, { u1: "confirmed" });
	});

	test("a response from an unassigned user is kept and flagged", () => {
		const docs = transformEventResponses(
			"e1",
			{
				date: "2025-06-15",
				assignedWorkers: ["u1"],
				workerStatus: { u1: "confirmed", u9: "declined" },
			},
			ctx(),
		);
		const orphan = docs.find((d) => d.userId === "u9");
		assert.equal(orphan.status, "declined");
		assert.equal(orphan.orphanedResponse, true);
	});

	test("an unrecognized status falls back to pending", () => {
		const docs = transformEventResponses(
			"e1",
			{
				date: "2025-06-15",
				assignedWorkers: ["u1"],
				workerStatus: { u1: "???" },
			},
			ctx(),
		);
		assert.equal(docs[0].status, "pending");
	});
});

describe("event checklist state", () => {
	test("tri-state integers survive", () => {
		const { doc } = transformChecklistState(
			"e1",
			[{ id: "cl1", data: { i1: 0, i2: 1, i3: 2 } }],
			ctx(),
		);
		assert.deepEqual(doc.state.cl1, { i1: 0, i2: 1, i3: 2 });
	});

	test("legacy booleans coerce to 1/0", () => {
		const { doc } = transformChecklistState(
			"e1",
			[{ id: "cl1", data: { i1: true, i2: false } }],
			ctx(),
		);
		assert.deepEqual(doc.state.cl1, { i1: 1, i2: 0 });
	});

	test('"undefined" keys are dropped and reported', () => {
		// Produced by legacy string[] checklists, where item.id was undefined.
		const { doc, issues } = transformChecklistState(
			"e1",
			[{ id: "cl1", data: { undefined: 1, i2: 1 } }],
			ctx(),
		);
		assert.deepEqual(doc.state.cl1, { i2: 1 });
		assert.ok(codes(issues).includes("CHECKLIST_STATE_UNDEFINED_KEY"));
	});

	test("no state produces no document", () => {
		const { doc } = transformChecklistState("e1", [], ctx());
		assert.equal(doc, null);
	});
});

describe("approval provenance", () => {
	test("approved with approvedBy is trusted", () => {
		const r = resolveReview({
			status: "approved",
			approvedBy: "mgr",
			approvedAt: "2025-06-15T12:00:00Z",
		});
		assert.equal(r.provenance, "trusted");
		assert.equal(r.decidedBy, "mgr");
	});

	test("approved with rejectedBy is the 2,104-record bug path", () => {
		const r = resolveReview({
			status: "approved",
			rejectedBy: "mgr",
			rejectedAt: "2025-06-15T12:00:00Z",
		});
		assert.equal(r.decision, "approved");
		assert.equal(r.decidedBy, "mgr");
		assert.equal(r.provenance, "inferred_from_status_bug");
	});

	test("approved with neither is unknown, never guessed", () => {
		const r = resolveReview({ status: "approved" });
		assert.equal(r.decidedBy, null);
		assert.equal(r.provenance, "unknown");
	});

	test("rejected keeps its reason", () => {
		const r = resolveReview({
			status: "rejected",
			rejectedBy: "mgr",
			rejectionReason: "missing break",
		});
		assert.equal(r.decision, "rejected");
		assert.equal(r.reason, "missing break");
	});

	test("un-reviewed entries have no review", () => {
		assert.equal(resolveReview({ status: "pending_approval" }), null);
		assert.equal(resolveReview({ status: "active" }), null);
	});

	test("raw v1 fields travel with the entry because the inference is lossy", () => {
		const { doc } = transformTimeEntry(
			"t1",
			{
				userId: "u1",
				status: "approved",
				clockInTime: "2025-06-15T13:00:00Z",
				clockOutTime: "2025-06-15T21:00:00Z",
				duration: 28800,
				rejectedBy: "mgr",
				rejectedAt: "2025-06-16T10:00:00Z",
			},
			ctx(),
		);
		assert.equal(doc.review.provenance, "inferred_from_status_bug");
		assert.equal(doc.legacy.rejectedBy, "mgr");
	});
});

describe("transformTimeEntry", () => {
	test("core fields and dateKey in company zone", () => {
		const { doc } = transformTimeEntry(
			"t1",
			{
				userId: "u1",
				status: "completed",
				clockInTime: "2025-06-16T01:30:00Z",
				clockOutTime: "2025-06-16T05:30:00Z",
				duration: 14400,
				totalPausedSeconds: 600,
			},
			ctx(),
		);
		// 01:30 UTC is still 15 June in New York.
		assert.equal(doc.dateKey, "2025-06-15");
		assert.equal(doc.workedSeconds, 14400);
		assert.equal(doc.pausedSeconds, 600);
		assert.equal(doc.companyId, "SoBridalSocial");
	});

	test("worked time exceeding elapsed time is flagged", () => {
		const { issues } = transformTimeEntry(
			"t1",
			{
				userId: "u1",
				status: "completed",
				clockInTime: "2025-06-15T13:00:00Z",
				clockOutTime: "2025-06-15T14:00:00Z",
				duration: 99999,
			},
			ctx(),
		);
		assert.ok(codes(issues).includes("WORKED_EXCEEDS_ELAPSED"));
	});

	test("counts match the subcollections that will be written", () => {
		const v1 = {
			userId: "u1",
			status: "edited",
			clockInTime: "2025-06-15T13:00:00Z",
			connectedEvents: [{ eventId: "e1" }, { eventId: "custom-123" }],
			editHistory: [{ userId: "u1", changeSummary: "x" }],
		};
		const { doc } = transformTimeEntry("t1", v1, ctx());
		assert.equal(doc.connectionCount, 2);
		assert.equal(doc.editCount, 1);
	});
});

describe("connectedEvents -> connections", () => {
	test("custom entries get a null eventId, not a magic prefix", () => {
		const { docs } = transformConnections(
			"t1",
			{
				userId: "u1",
				connectedEvents: [
					{
						eventId: "custom-1757949227934",
						eventTitle: "Ad hoc job",
					},
				],
			},
			ctx({ eventIds: new Set() }),
		);
		assert.equal(docs[0].id, "custom_1757949227934");
		assert.equal(docs[0].eventId, null);
		assert.equal(docs[0].customTitle, "Ad hoc job");
	});

	test("real events keep their id", () => {
		const { docs } = transformConnections(
			"t1",
			{
				userId: "u1",
				connectedEvents: [{ eventId: "e1", eventTitle: "Wedding" }],
			},
			ctx({ eventIds: new Set(["e1"]) }),
		);
		assert.equal(docs[0].eventId, "e1");
		assert.equal(docs[0].customTitle, null);
	});

	test("a dangling event reference degrades to a titled custom entry", () => {
		const { docs, issues } = transformConnections(
			"t1",
			{
				userId: "u1",
				connectedEvents: [
					{ eventId: "new-event-1757949227934", eventTitle: "Ghost" },
				],
			},
			ctx({ eventIds: new Set(["e1"]) }),
		);
		assert.equal(docs[0].eventId, null);
		assert.equal(docs[0].eventTitleSnapshot, "Ghost");
		assert.ok(codes(issues).includes("CONNECTION_DANGLING"));
	});
});

describe("editHistory 3 shapes -> 1", () => {
	test("shape A (EditSheet) keeps its before-state", () => {
		const { docs } = transformEdits(
			"t1",
			{
				editHistory: [
					{
						timestamp: "2025-06-15T12:00:00Z",
						editor: { userId: "u1", displayName: "Alice" },
						summary: "Changed clock out",
						previousClockOutTime: "2025-06-15T20:00:00Z",
						previousDuration: 3600,
					},
				],
			},
			ctx(),
		);
		assert.equal(docs[0].source, "editSheet");
		assert.equal(docs[0].actorDisplayName, "Alice");
		assert.equal(docs[0].before.workedSeconds, 3600);
	});

	test("shape B resolves the display name that v1 never stored", () => {
		// 2,088 production records are this shape, and the renderer read a key
		// no writer produced — so none of them ever showed an author.
		const { docs } = transformEdits(
			"t1",
			{
				editHistory: [
					{
						timestamp: "2025-06-15T12:00:00Z",
						userId: "u1",
						changeSummary: "Adjusted notes",
					},
				],
			},
			ctx({ displayNameFor: (id) => (id === "u1" ? "Alice" : null) }),
		);
		assert.equal(docs[0].source, "detailsField");
		assert.equal(docs[0].actorDisplayName, "Alice");
		assert.equal(docs[0].summary, "Adjusted notes");
		assert.equal(docs[0].before, null);
	});

	test("an unknown shape is preserved verbatim rather than dropped", () => {
		const { docs, issues } = transformEdits(
			"t1",
			{ editHistory: [{ mystery: true }] },
			ctx(),
		);
		assert.equal(docs[0].source, "legacy_unknown");
		assert.deepEqual(docs[0].rawLegacy, { mystery: true });
		assert.ok(codes(issues).includes("EDIT_SHAPE_UNKNOWN"));
	});

	test("ids are stable and ordered, so re-runs are idempotent", () => {
		const { docs } = transformEdits(
			"t1",
			{ editHistory: [{ mystery: 1 }, { mystery: 2 }] },
			ctx(),
		);
		assert.deepEqual(
			docs.map((d) => d.id),
			["t1-0000", "t1-0001"],
		);
	});
});

describe("attachments — both production generations", () => {
	test("modern shape", () => {
		const { doc } = transformAttachment(
			"a1",
			{
				id: "a1",
				name: "photo.jpg",
				type: "image/jpeg",
				size: 1024,
				storageRef: "companies/c1/Events/e1/a1",
				downloadUrl: "https://example.com/a1",
				thumbnailStorageRef: "companies/c1/Events/e1/a1_thumbnail",
				thumbnailUrl: "https://example.com/a1_thumb",
			},
			{ companyId: "c1", parentType: "event", parentId: "e1" },
		);
		assert.equal(doc.storagePath, "companies/c1/Events/e1/a1");
		assert.equal(doc.downloadUrl, "https://example.com/a1");
		assert.equal(doc.thumbnailDownloadUrl, "https://example.com/a1_thumb");
	});

	test("legacy shape uses path/url/uploadTime, not storageRef", () => {
		// 13 of 32 production attachments look like this. Reading `storageRef`
		// as missing would have orphaned their Storage objects.
		const { doc, issues } = transformAttachment(
			"a2",
			{
				id: "a2",
				name: "old.jpg",
				type: "image/jpeg",
				path: "companies/c1/Events/e1/a2",
				url: "https://example.com/a2",
				uploadTime: 1700000000000,
			},
			{ companyId: "c1", parentType: "event", parentId: "e1" },
		);
		assert.equal(doc.storagePath, "companies/c1/Events/e1/a2");
		assert.equal(doc.downloadUrl, "https://example.com/a2");
		assert.equal(doc.createdAt.toISOString(), "2023-11-14T22:13:20.000Z");
		assert.deepEqual(issues, []);
	});

	test("a missing path is derived from the known Storage layout", () => {
		const { doc, issues } = transformAttachment(
			"a3",
			{ id: "a3", name: "x.jpg", type: "image/jpeg", url: "https://e/x" },
			{ companyId: "c1", parentType: "timeEntry", parentId: "t1" },
		);
		// Lowercase "companies", PascalCase parent — preserved from v1 verbatim.
		assert.equal(doc.storagePath, "companies/c1/TimeEntries/t1/a3");
		assert.ok(codes(issues).includes("STORAGE_PATH_DERIVED"));
	});

	test("with neither a path nor a url it is unrecoverable, not invented", () => {
		const { doc, issues } = transformAttachment(
			"a4",
			{ name: "lost.jpg" },
			{ companyId: "c1", parentType: "unknown", parentId: "p1" },
		);
		assert.equal(doc, null);
		assert.ok(codes(issues).includes("ATTACHMENT_UNRECOVERABLE"));
	});
});

describe("identity", () => {
	test("role normalization covers legacy capitalization", () => {
		assert.equal(normalizeRole("owner"), "owner");
		assert.equal(normalizeRole("Owner"), "owner");
		assert.equal(normalizeRole("Admin"), "manager");
		assert.equal(normalizeRole(undefined), "user");
	});

	test("user gains emailLower and loses membership", () => {
		const { doc } = transformUser("u1", {
			firstName: "Alice",
			email: "Alice@Example.COM",
			companies: ["c1"],
			loggedInCompany: "c1",
			fcmToken: ["tok"],
		});
		assert.equal(doc.emailLower, "alice@example.com");
		assert.equal(doc.loggedInCompanyId, "c1");
		assert.deepEqual(doc.fcmTokens, ["tok"]);
		assert.equal(doc.companies, undefined);
	});

	test("a missing membership document is reported, not silently defaulted", () => {
		const { doc, issues } = transformMembership({
			companyId: "c1",
			userId: "u1",
			membershipDoc: null,
			userDoc: { firstName: "Alice", email: "a@e.com" },
		});
		assert.equal(doc.id, "c1_u1");
		assert.equal(doc.role, "user");
		assert.ok(codes(issues).includes("MEMBERSHIP_DOC_MISSING"));
	});

	test("membership denormalizes the profile to kill the N+1", () => {
		const { doc } = transformMembership({
			companyId: "c1",
			userId: "u1",
			membershipDoc: { role: "Admin" },
			userDoc: { firstName: "Alice", lastName: "A", email: "a@e.com" },
		});
		assert.equal(doc.role, "manager");
		assert.equal(doc.firstName, "Alice");
	});
});

describe("form schema registry", () => {
	test("identical embedded schemas dedupe to one document", () => {
		const registry = createSchemaRegistry("c1");
		const schema = {
			title: "T",
			fields: [{ id: "1", label: "L", type: "text" }],
		};
		const a = registry.register("eventForm", schema);
		const b = registry.register("eventForm", { ...schema });
		assert.equal(a.id, b.id);
		assert.equal(registry.documents().length, 1);
	});

	test("different schemas get sequential versions", () => {
		const registry = createSchemaRegistry("c1");
		registry.register("eventForm", { title: "A", fields: [] });
		registry.register("eventForm", { title: "B", fields: [] });
		const docs = registry.documents();
		assert.deepEqual(
			docs.map((d) => d.id),
			["c1_eventForm_v1", "c1_eventForm_v2"],
		);
	});

	test("null schemas register as nothing", () => {
		const registry = createSchemaRegistry("c1");
		assert.equal(registry.register("eventForm", null), null);
		assert.equal(registry.documents().length, 0);
	});
});

describe("library collections", () => {
	test("modern checklist items pass through", () => {
		const { doc, issues } = transformChecklist(
			"cl1",
			{ title: "Setup", items: [{ id: "i1", text: "Chairs" }] },
			ctx(),
		);
		assert.deepEqual(doc.items, [{ id: "i1", text: "Chairs" }]);
		assert.deepEqual(issues, []);
	});

	test("legacy string items get index-derived, stable ids", () => {
		const { doc, issues } = transformChecklist(
			"cl1",
			{ title: "Setup", items: ["Chairs", "Tables"] },
			ctx(),
		);
		assert.deepEqual(doc.items, [
			{ id: "i0", text: "Chairs" },
			{ id: "i1", text: "Tables" },
		]);
		assert.ok(codes(issues).includes("CHECKLIST_LEGACY_STRING_ITEM"));
	});

	test("legacy `name` key folds into title", () => {
		const { doc, issues } = transformChecklist(
			"cl1",
			{ name: "Old", items: [] },
			ctx(),
		);
		assert.equal(doc.title, "Old");
		assert.ok(codes(issues).includes("CHECKLIST_LEGACY_NAME_KEY"));
	});

	test("package checklists flatten to plain ids", () => {
		const { doc } = transformPackage(
			"p1",
			{
				title: "Full",
				checklists: [{ checklistId: "cl1" }, { checklistId: "cl2" }],
			},
			ctx({ checklistIds: new Set(["cl1", "cl2"]) }),
		);
		assert.deepEqual(doc.checklistIds, ["cl1", "cl2"]);
	});

	test("dangling package checklist is dropped and reported", () => {
		const { doc, issues } = transformPackage(
			"p1",
			{ title: "Full", checklists: [{ checklistId: "ghost" }] },
			ctx({ checklistIds: new Set(["cl1"]) }),
		);
		assert.deepEqual(doc.checklistIds, []);
		assert.ok(codes(issues).includes("PACKAGE_CHECKLIST_DANGLING"));
	});
});
