import { useCallback, useEffect, useState } from "react";
import { getConnections } from "@app/services/timeEntryEditService";
import type { TimeEntryConnection } from "@app/types";

/*
 * The connected events for a set of time entries.
 *
 * Connections are a subcollection per entry, so there is no way to fetch a
 * period's worth in one query — it is one read per shift. Shared between the
 * entries table (which shows their NAMES) and the week view (which shows their
 * answers too), so a period is fetched once and both views read the same map
 * rather than each paying for it.
 *
 * Entries with `connectionCount === 0` are skipped outright: the overwhelming
 * majority of shifts have none, and reading a subcollection to be told it is
 * empty is the kind of thing that makes a 40-shift period feel slow.
 */
export function useConnections(
	entries: { id: string; connectionCount?: number }[],
) {
	const [byEntryId, setByEntryId] = useState<
		Record<string, TimeEntryConnection[]>
	>({});
	const [reloadKey, setReloadKey] = useState(0);

	// Keyed on the ids that will actually be fetched, so a re-render with an
	// equal-but-new array does not refetch the period.
	const fetchable = entries
		.filter((entry) => (entry.connectionCount ?? 0) > 0)
		.map((entry) => entry.id)
		.join(",");

	useEffect(() => {
		const ids = fetchable ? fetchable.split(",") : [];
		if (!ids.length) {
			setByEntryId({});
			return;
		}
		let live = true;
		Promise.all(
			ids.map((id) =>
				getConnections(id)
					.then((list) => [id, list] as const)
					.catch(() => [id, [] as TimeEntryConnection[]] as const),
			),
		).then((pairs) => {
			if (live) setByEntryId(Object.fromEntries(pairs));
		});
		return () => {
			live = false;
		};
	}, [fetchable, reloadKey]);

	/** Re-read after an edit, so a changed answer shows without a page reload. */
	const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

	return { byEntryId, refresh };
}
