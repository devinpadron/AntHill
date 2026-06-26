export const hoursFromSeconds = (s: number | null | undefined) =>
	(s ?? 0) / 3600;

export const fmtHours = (s: number | null | undefined) =>
	`${hoursFromSeconds(s).toFixed(1)} h`;

export function fmtDate(iso: string | null | undefined) {
	if (!iso) return "—";
	return new Date(iso).toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

export function fmtTimeRange(
	startIso: string | null | undefined,
	endIso: string | null | undefined,
) {
	const t = (iso?: string | null) =>
		iso
			? new Date(iso).toLocaleTimeString(undefined, {
					hour: "numeric",
					minute: "2-digit",
				})
			: "—";
	if (!startIso) return "—";
	return `${t(startIso)} – ${endIso ? t(endIso) : "now"}`;
}

export const STATUS_PILL: Record<string, { cls: string; label: string }> = {
	approved: { cls: "pill--olive", label: "Approved" },
	pending_approval: { cls: "pill--amber", label: "Pending" },
	rejected: { cls: "pill--rust", label: "Rejected" },
	active: { cls: "pill--info", label: "Active" },
	paused: { cls: "pill--neutral", label: "Paused" },
	completed: { cls: "pill--neutral", label: "Completed" },
	edited: { cls: "pill--neutral", label: "Edited" },
};
