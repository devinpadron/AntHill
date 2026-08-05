import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
	classifyTimestamp,
	toDate,
	toDateKey,
	zonedDateTimeToInstant,
} from "./timestamps.mjs";
import {
	hoursStringToSeconds,
	resolveEventDurationSeconds,
	secondsBetween,
} from "./duration.mjs";
import {
	connectionId,
	editId,
	formSchemaHash,
	isCustomConnection,
} from "./ids.mjs";

const EASTERN = "America/New_York";

describe("classifyTimestamp", () => {
	const cases = [
		[null, "empty"],
		["", "empty"],
		[new Date(), "timestamp"],
		[1757949227934, "epochMillis"],
		["2025-06-15", "dateOnly"],
		["2025-06-15T17:30:00.000Z", "isoOffset"],
		["2025-06-15T17:30:00-04:00", "isoOffset"],
		["2025-06-15T17:30:00", "isoNoOffset"],
		["2025-06-15 17:30", "dateTimeSpace"],
		// Found only by profiling production — 16 event times look like this.
		["17:30", "timeOnly"],
		["11:00", "timeOnly"],
		["not a date", "unparseable"],
	];

	for (const [input, expected] of cases) {
		test(`${JSON.stringify(input)} -> ${expected}`, () => {
			assert.equal(classifyTimestamp(input).branch, expected);
		});
	}

	test("only offset-less forms need a timezone", () => {
		assert.equal(
			classifyTimestamp("2025-06-15T17:30:00Z").needsTimeZone,
			false,
		);
		assert.equal(
			classifyTimestamp("2025-06-15T17:30:00").needsTimeZone,
			true,
		);
		assert.equal(classifyTimestamp("17:30").needsTimeZone, true);
	});
});

describe("zonedDateTimeToInstant — DST correctness", () => {
	// This is the whole reason for America/New_York over a fixed "EST".
	test("summer date resolves as EDT (UTC-4)", () => {
		const instant = zonedDateTimeToInstant("2025-06-15", "17:30", EASTERN);
		assert.equal(instant.toISOString(), "2025-06-15T21:30:00.000Z");
	});

	test("winter date resolves as EST (UTC-5)", () => {
		const instant = zonedDateTimeToInstant("2025-01-15", "17:30", EASTERN);
		assert.equal(instant.toISOString(), "2025-01-15T22:30:00.000Z");
	});

	test("a fixed offset would have been wrong by an hour in summer", () => {
		const summer = zonedDateTimeToInstant("2025-06-15", "17:30", EASTERN);
		const naiveFixed = new Date("2025-06-15T17:30:00-05:00");
		assert.notEqual(summer.getTime(), naiveFixed.getTime());
		assert.equal(naiveFixed.getTime() - summer.getTime(), 3600 * 1000);
	});

	test("the day after spring-forward is EDT", () => {
		const instant = zonedDateTimeToInstant("2025-03-10", "12:00", EASTERN);
		assert.equal(instant.toISOString(), "2025-03-10T16:00:00.000Z");
	});

	test("single-digit hours are accepted", () => {
		const instant = zonedDateTimeToInstant("2025-06-15", "9:05", EASTERN);
		assert.equal(instant.toISOString(), "2025-06-15T13:05:00.000Z");
	});
});

describe("toDate", () => {
	test("resolves a bare time using the event's own dateKey", () => {
		const r = toDate("17:30", { dateKey: "2025-06-15", timeZone: EASTERN });
		assert.equal(r.ok, true);
		assert.equal(r.assumedTimeZone, true);
		assert.equal(r.value.toISOString(), "2025-06-15T21:30:00.000Z");
	});

	test("a bare time with no dateKey FAILS rather than guessing", () => {
		const r = toDate("17:30", { timeZone: EASTERN });
		assert.equal(r.ok, false);
		assert.equal(r.raw, "17:30");
	});

	test("empty is a successful null, not a failure", () => {
		assert.deepEqual(toDate(null), {
			ok: true,
			value: null,
			branch: "empty",
		});
	});

	test("a date-only value is not an instant", () => {
		assert.equal(toDate("2025-06-15").ok, false);
	});

	test("garbage never silently becomes a date", () => {
		const r = toDate("¯\\_(ツ)_/¯");
		assert.equal(r.ok, false);
		assert.equal(r.branch, "unparseable");
	});
});

describe("toDateKey", () => {
	test("uses the company zone, not the host zone", () => {
		// 01:30 UTC is still the previous evening in New York.
		const d = new Date("2025-06-16T01:30:00.000Z");
		assert.equal(toDateKey(d, EASTERN), "2025-06-15");
	});
});

describe("duration", () => {
	test("hours-as-string becomes whole seconds", () => {
		assert.equal(hoursStringToSeconds("3.50"), 12600);
		assert.equal(hoursStringToSeconds("0"), 0);
		assert.equal(hoursStringToSeconds(""), null);
		assert.equal(hoursStringToSeconds("abc"), null);
	});

	test("secondsBetween", () => {
		const a = new Date("2025-06-15T17:00:00Z");
		const b = new Date("2025-06-15T20:30:00Z");
		assert.equal(secondsBetween(a, b), 12600);
		assert.equal(secondsBetween(a, null), null);
	});

	test("computed wins and reports a disagreement", () => {
		const r = resolveEventDurationSeconds({
			startAt: new Date("2025-06-15T17:00:00Z"),
			endAt: new Date("2025-06-15T20:00:00Z"),
			legacyDuration: "5.00",
		});
		assert.equal(r.seconds, 10800);
		assert.equal(r.source, "computed");
		assert.deepEqual(r.disagreement, { computed: 10800, stored: 18000 });
	});

	test("agreement within a minute is not flagged", () => {
		const r = resolveEventDurationSeconds({
			startAt: new Date("2025-06-15T17:00:00Z"),
			endAt: new Date("2025-06-15T20:00:00Z"),
			legacyDuration: "3.00",
		});
		assert.equal(r.disagreement, undefined);
	});

	test("falls back to the stored string for all-day events", () => {
		const r = resolveEventDurationSeconds({
			startAt: null,
			endAt: null,
			legacyDuration: "8.00",
		});
		assert.equal(r.seconds, 28800);
		assert.equal(r.source, "stored");
	});
});

describe("connection ids", () => {
	// Production: 1,984 written as `custom-`, filtered on `custom_`.
	test("both custom separators normalize to one form", () => {
		assert.equal(
			connectionId("custom-1757949227934"),
			"custom_1757949227934",
		);
		assert.equal(
			connectionId("custom_1757949227934"),
			"custom_1757949227934",
		);
	});

	test("real event ids pass through untouched", () => {
		assert.equal(
			connectionId("gwq01o0Ffxgk7UWgb2us"),
			"gwq01o0Ffxgk7UWgb2us",
		);
	});

	test("both separators are recognized as custom", () => {
		assert.equal(isCustomConnection("custom-123"), true);
		assert.equal(isCustomConnection("custom_123"), true);
		assert.equal(isCustomConnection("realEventId"), false);
	});
});

describe("edit ids sort in original order", () => {
	test("zero padded", () => {
		assert.equal(editId("entry1", 0), "entry1-0000");
		assert.equal(editId("entry1", 9), "entry1-0009");
		const sorted = [editId("e", 10), editId("e", 2)].sort();
		assert.deepEqual(sorted, ["e-0002", "e-0010"]);
	});
});

describe("formSchemaHash", () => {
	test("field key order does not create a new schema", () => {
		const a = {
			title: "T",
			fields: [{ id: "1", label: "L", type: "text" }],
		};
		const b = {
			title: "T",
			fields: [{ type: "text", label: "L", id: "1" }],
		};
		assert.equal(formSchemaHash(a), formSchemaHash(b));
	});

	test("a real content change does", () => {
		const a = {
			title: "T",
			fields: [{ id: "1", label: "L", type: "text" }],
		};
		const b = {
			title: "T",
			fields: [{ id: "1", label: "CHANGED", type: "text" }],
		};
		assert.notEqual(formSchemaHash(a), formSchemaHash(b));
	});
});
