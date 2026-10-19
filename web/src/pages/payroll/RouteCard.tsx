import { useEntryTrack } from "@app/hooks/useEntryTrack";
import type { LocationTrackSummary } from "@app/types";
import { mapsLinkFor } from "../../lib/googleMaps";
import { Button, Card, EmptyState, MapCanvas, Text } from "../../ui";
import styles from "./TimeEntryDetailPage.module.css";

/*
 * Where a shift was worked. Mirrors src/components/time/TrackMapCard.
 *
 * The rule this component exists to enforce: AN ABSENT ROUTE IS NEVER DRAWN AS
 * AN EMPTY MAP. A manager looking at a blank map on a timesheet will read it as
 * "this person did not go anywhere", and will act on that. Most of the time the
 * real reason is that nobody was able to look — permission refused, location
 * services off, the worker declined. Each of those gets a sentence saying so.
 *
 * `summary` null means the company had tracking switched off, or the entry
 * predates the feature. That renders nothing at all.
 *
 * `useEntryTrack` is the app's own hook: same sort, same downsampling, same
 * distance — so the figure here is the one the worker sees on their phone.
 */

const REASONS: Record<string, string> = {
	declined:
		"This worker declined location tracking for this company. Nothing was recorded.",
	denied: "Location permission was not granted on this worker's phone, so the shift could not be tracked.",
	unavailable:
		"Location services were switched off on this worker's phone for this shift.",
};

/** Metric or imperial is a per-company question nobody has asked yet. */
function formatDistance(meters: number): string {
	const miles = meters / 1609.344;
	if (miles < 0.1) return "less than 0.1 mi";
	return `${miles.toFixed(1)} mi`;
}

export function RouteCard({
	entryId,
	summary,
}: {
	entryId: string;
	summary: LocationTrackSummary | null;
}) {
	const shouldLoad =
		summary?.status === "recording" || summary?.status === "completed";
	const { points, distanceMeters, isLoading } = useEntryTrack(
		shouldLoad ? entryId : null,
	);

	if (!summary) return null;

	const reason = REASONS[summary.status];
	if (reason) {
		return (
			<Card title="Route">
				<EmptyState
					icon="location-outline"
					title="No route recorded"
					description={reason}
				/>
			</Card>
		);
	}

	if (isLoading) {
		return (
			<Card title="Route">
				<Text variant="caption" tone="secondary">
					Loading route…
				</Text>
			</Card>
		);
	}

	/*
	 * Tracking WAS on and points still did not arrive. Said differently from
	 * the refusals above: this one really can mean the worker never left the
	 * building, but equally a shift that ended before the first fix landed.
	 */
	if (points.length < 2) {
		return (
			<Card title="Route">
				<EmptyState
					icon="location-outline"
					title="No movement recorded"
					description={
						summary.status === "recording"
							? "This shift is still open. The route appears as points arrive."
							: "Tracking was on for this shift but no movement was recorded."
					}
				/>
			</Card>
		);
	}

	const start = points[0];
	const end = points[points.length - 1];
	const success = getComputedStyle(document.documentElement)
		.getPropertyValue("--c-success")
		.trim();
	const danger = getComputedStyle(document.documentElement)
		.getPropertyValue("--c-danger")
		.trim();

	return (
		<Card title="Route">
			<MapCanvas
				center={{ lat: end.lat, lng: end.lng }}
				path={points.map((p) => ({ lat: p.lat, lng: p.lng }))}
				markers={[
					{
						position: { lat: start.lat, lng: start.lng },
						title: "Clocked in",
						color: success,
					},
					{
						position: { lat: end.lat, lng: end.lng },
						title:
							summary.status === "recording"
								? "Last seen"
								: "Clocked out",
						color: danger,
					},
				]}
			/>
			<div className={styles.routeFooter}>
				<div>
					<Text variant="bodyStrong">
						{formatDistance(distanceMeters)}
					</Text>
					<Text variant="caption" tone="tertiary">
						{summary.pointCount} point
						{summary.pointCount === 1 ? "" : "s"} recorded
					</Text>
				</div>
				<a
					href={mapsLinkFor(end.lat, end.lng)}
					target="_blank"
					rel="noopener noreferrer"
				>
					<Button
						variant="secondary"
						size="small"
						icon="navigate-outline"
					>
						Open in maps
					</Button>
				</a>
			</div>
		</Card>
	);
}
