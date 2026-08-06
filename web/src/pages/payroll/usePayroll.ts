import { useEffect, useMemo, useState } from "react";
import { subscribeTimeEntries } from "@app/services/timeEntryService";
import { useCompanyMembers } from "@app/hooks/useCompanyMembers";
import type { Membership, TimeEntry, TimeEntryStatus } from "@app/types";
import { useCompany } from "../../contexts/CompanyContext";

/*
 * A pay period, per employee.
 *
 * The week boundary comes from `preferences.workWeekStarts` — the same setting
 * the app's PayrollReview uses. A portal that disagreed with the phone about
 * where the week starts would produce two different totals for the same work,
 * which is the one thing payroll cannot do.
 *
 * Entries arrive through `subscribeTimeEntries`, so an approval made on a phone
 * updates the table here without a reload.
 */

export type EmployeeTotals = {
	member: Membership;
	entries: TimeEntry[];
	workedSeconds: number;
	pausedSeconds: number;
	netSeconds: number;
	days: number;
	longestSeconds: number;
	pending: number;
	approved: number;
	rejected: number;
	lastOut: Date | null;
	/** Hours per day across the period, for the sparkline. */
	perDay: number[];
};

export function startOfWeek(date: Date, startsMonday: boolean): Date {
	const result = new Date(date);
	const day = result.getDay();
	const delta = startsMonday ? (day + 6) % 7 : day;
	result.setDate(result.getDate() - delta);
	result.setHours(0, 0, 0, 0);
	return result;
}

/** Local YYYY-MM-DD. toISOString would shift the day in most time zones. */
export function toDateKey(date: Date): string {
	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, "0"),
		String(date.getDate()).padStart(2, "0"),
	].join("-");
}

export function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

/**
 * Worked time, minus pauses.
 *
 * `workedSeconds` is null on an entry that is still running, so the elapsed
 * time is derived from clock-in. An admin looking at a live shift should see it
 * ticking, not a blank.
 */
export function netSecondsOf(entry: TimeEntry): number {
	const worked =
		entry.workedSeconds ??
		(entry.clockInAt
			? Math.max(
					0,
					Math.round(
						(Date.now() - entry.clockInAt.toMillis()) / 1000,
					),
				)
			: 0);
	return Math.max(0, worked - (entry.pausedSeconds ?? 0));
}

export function usePayroll(from: Date, to: Date) {
	const { companyId } = useCompany();
	const { members } = useCompanyMembers(companyId);
	const [entries, setEntries] = useState<TimeEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const fromKey = toDateKey(from);
	const toKey = toDateKey(to);

	useEffect(() => {
		setIsLoading(true);
		const unsubscribe = subscribeTimeEntries(
			companyId,
			{ from: fromKey, to: toKey, limit: 500 },
			(next) => {
				setEntries(next);
				setIsLoading(false);
			},
		);
		return unsubscribe;
	}, [companyId, fromKey, toKey]);

	const dayKeys = useMemo(() => {
		const keys: string[] = [];
		for (
			let cursor = new Date(from);
			cursor <= to;
			cursor = addDays(cursor, 1)
		) {
			keys.push(toDateKey(cursor));
		}
		return keys;
	}, [fromKey, toKey]);

	const byEmployee = useMemo<EmployeeTotals[]>(() => {
		const grouped = new Map<string, TimeEntry[]>();
		for (const entry of entries) {
			grouped.set(entry.userId, [
				...(grouped.get(entry.userId) ?? []),
				entry,
			]);
		}

		return [...grouped.entries()]
			.map(([userId, list]) => {
				const member = members.find((m) => m.userId === userId);
				const worked = list.reduce(
					(sum, entry) =>
						sum +
						(entry.workedSeconds ??
							netSecondsOf(entry) + (entry.pausedSeconds ?? 0)),
					0,
				);
				const paused = list.reduce(
					(sum, entry) => sum + (entry.pausedSeconds ?? 0),
					0,
				);

				const perDay = dayKeys.map((key) =>
					list
						.filter((entry) => entry.dateKey === key)
						.reduce((sum, entry) => sum + netSecondsOf(entry), 0),
				);

				const outs = list
					.map((entry) => entry.clockOutAt?.toDate?.())
					.filter(Boolean) as Date[];

				return {
					member:
						member ??
						({
							id: userId,
							userId,
							firstName: "Former",
							lastName: "member",
						} as Membership),
					entries: list,
					workedSeconds: worked,
					pausedSeconds: paused,
					netSeconds: worked - paused,
					days: new Set(list.map((entry) => entry.dateKey)).size,
					longestSeconds: Math.max(
						0,
						...list.map((entry) => netSecondsOf(entry)),
					),
					pending: list.filter(
						(entry) => entry.status === "pending_approval",
					).length,
					approved: list.filter(
						(entry) => entry.status === "approved",
					).length,
					rejected: list.filter(
						(entry) => entry.status === "rejected",
					).length,
					lastOut: outs.length
						? new Date(Math.max(...outs.map((d) => d.getTime())))
						: null,
					perDay,
				};
			})
			.sort((a, b) =>
				`${a.member.lastName}${a.member.firstName}`.localeCompare(
					`${b.member.lastName}${b.member.firstName}`,
				),
			);
	}, [entries, members, dayKeys]);

	const statusCounts = useMemo(() => {
		const counts: Partial<Record<TimeEntryStatus | "all", number>> = {
			all: entries.length,
		};
		for (const entry of entries) {
			counts[entry.status] = (counts[entry.status] ?? 0) + 1;
		}
		return counts;
	}, [entries]);

	/*
	 * The things worth chasing, which the phone has nowhere to put.
	 *
	 * `provenance` is the interesting one: entries approved before the review
	 * block existed carry "inferred_from_status_bug", meaning nobody actually
	 * knows who approved them. Surfacing that beats quietly showing a name.
	 */
	const attention = useMemo(() => {
		const TWELVE_HOURS = 12 * 3600 * 1000;
		const now = Date.now();
		return {
			stillRunning: entries.filter(
				(entry) =>
					entry.status === "active" &&
					entry.clockInAt &&
					now - entry.clockInAt.toMillis() > TWELVE_HOURS,
			),
			stuckPaused: entries.filter(
				(entry) =>
					entry.status === "paused" &&
					entry.pauseStartedAt &&
					now - entry.pauseStartedAt.toMillis() > TWELVE_HOURS,
			),
			untrustedReview: entries.filter(
				(entry) =>
					entry.review && entry.review.provenance !== "trusted",
			),
			edited: entries.filter((entry) => (entry.editCount ?? 0) > 0),
			noEntries: members.filter(
				(member) =>
					member.status === "active" &&
					!entries.some((entry) => entry.userId === member.userId),
			),
		};
	}, [entries, members]);

	const totals = useMemo(
		() => ({
			workedSeconds: byEmployee.reduce((s, e) => s + e.workedSeconds, 0),
			pausedSeconds: byEmployee.reduce((s, e) => s + e.pausedSeconds, 0),
			netSeconds: byEmployee.reduce((s, e) => s + e.netSeconds, 0),
			entries: entries.length,
			employees: byEmployee.length,
			pending: entries.filter((e) => e.status === "pending_approval")
				.length,
		}),
		[byEmployee, entries],
	);

	return {
		entries,
		byEmployee,
		statusCounts,
		attention,
		totals,
		dayKeys,
		isLoading,
	};
}
