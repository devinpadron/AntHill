import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Button, Card, EmptyState, Text } from "../ui";
import { LocationTrackSummary } from "../../types";
import { useEntryTrack } from "../../hooks/useEntryTrack";
import { getRegionForMarkers, openMap } from "../../utils/mapUtils";
import { Theme, useTheme, useThemedStyles } from "../../theme";

/*
 * Where a shift was worked.
 *
 * The rule this component exists to enforce: AN ABSENT ROUTE IS NEVER DRAWN AS
 * AN EMPTY MAP. A manager looking at a blank map on a timesheet will read it as
 * "this person did not go anywhere", and will act on that. Most of the time the
 * real reason is that nobody was able to look — permission refused, location
 * services off, the worker declined. Each of those gets a sentence saying so.
 *
 * `summary` null means the company had tracking switched off, or the entry
 * predates the feature. That renders nothing at all, rather than an explanation
 * of an absence nobody expected to be filled.
 */

type TrackMapCardProps = {
	entryId: string;
	summary: LocationTrackSummary | null;
	/** The user's preferred map app, for the "Open in maps" handoff. */
	preferredMapApp?: string;
};

/** Metric or imperial is a per-company question nobody has asked yet. */
function formatDistance(meters: number): string {
	const miles = meters / 1609.344;
	if (miles < 0.1) return "less than 0.1 mi";
	return `${miles.toFixed(1)} mi`;
}

const REASONS: Record<string, { title: string; description: string }> = {
	declined: {
		title: "No route recorded",
		description:
			"This worker declined location tracking for this company. Nothing was recorded.",
	},
	denied: {
		title: "No route recorded",
		description:
			"Location permission was not granted on this worker's phone, so the shift could not be tracked.",
	},
	unavailable: {
		title: "No route recorded",
		description:
			"Location services were switched off on this worker's phone for this shift.",
	},
};

export const TrackMapCard: React.FC<TrackMapCardProps> = ({
	entryId,
	summary,
	preferredMapApp = "",
}) => {
	const styles = useThemedStyles(trackStyles);
	const theme = useTheme();

	/*
	 * The hook is called unconditionally — hooks cannot be skipped — but it is
	 * given a null id when there is nothing to fetch, which short-circuits the
	 * read rather than firing one per entry on a payroll screen.
	 */
	const shouldLoad =
		summary?.status === "recording" || summary?.status === "completed";
	const { points, distanceMeters, isLoading } = useEntryTrack(
		shouldLoad ? entryId : null,
	);

	const region = useMemo(() => {
		if (points.length === 0) return null;
		return getRegionForMarkers(
			points.map((point) => ({
				latitude: point.lat,
				longitude: point.lng,
				title: "",
			})),
		);
	}, [points]);

	const coordinates = useMemo(
		() =>
			points.map((point) => ({
				latitude: point.lat,
				longitude: point.lng,
			})),
		[points],
	);

	if (!summary) return null;

	const reason = REASONS[summary.status];
	if (reason) {
		return (
			<Card title="Route" style={styles.card}>
				<EmptyState
					icon="location-outline"
					title={reason.title}
					description={reason.description}
					compact
				/>
			</Card>
		);
	}

	if (isLoading) {
		return (
			<Card title="Route" style={styles.card}>
				<Text variant="caption" color="textSecondary">
					Loading route…
				</Text>
			</Card>
		);
	}

	/*
	 * Tracking WAS on and points still did not arrive. Said differently from
	 * the refusals above, because this one really can mean the worker never
	 * left the building — but it can equally mean a shift that ended before the
	 * first fix landed, so it stops short of claiming either.
	 */
	if (!region || coordinates.length < 2) {
		return (
			<Card title="Route" style={styles.card}>
				<EmptyState
					icon="location-outline"
					title="No movement recorded"
					description={
						summary.status === "recording"
							? "This shift is still open. The route appears as points arrive."
							: "Tracking was on for this shift but no movement was recorded."
					}
					compact
				/>
			</Card>
		);
	}

	const start = points[0];
	const end = points[points.length - 1];

	return (
		<Card title="Route" flush style={styles.card}>
			<MapView style={styles.map} region={region} scrollEnabled>
				<Polyline
					coordinates={coordinates}
					strokeColor={theme.colors.accent}
					strokeWidth={4}
				/>
				<Marker
					coordinate={{ latitude: start.lat, longitude: start.lng }}
					title="Clocked in"
					pinColor={theme.colors.success}
				/>
				<Marker
					coordinate={{ latitude: end.lat, longitude: end.lng }}
					title={
						summary.status === "recording"
							? "Last seen"
							: "Clocked out"
					}
					pinColor={theme.colors.danger}
				/>
			</MapView>

			<View style={styles.footer}>
				<View>
					<Text variant="bodyStrong">
						{formatDistance(distanceMeters)}
					</Text>
					<Text variant="caption" color="textTertiary">
						{summary.pointCount} point
						{summary.pointCount === 1 ? "" : "s"} recorded
					</Text>
				</View>

				<Button
					title="Open in maps"
					icon="navigate-outline"
					variant="secondary"
					size="small"
					onPress={() =>
						openMap(
							{
								latitude: end.lat,
								longitude: end.lng,
								title: "Clock out location",
								label: "Clock out location",
							},
							preferredMapApp,
							`${end.lat},${end.lng}`,
						)
					}
				/>
			</View>
		</Card>
	);
};

const trackStyles = (theme: Theme) =>
	StyleSheet.create({
		card: {
			marginTop: theme.spacing.lg,
		},
		map: {
			height: 220,
			width: "100%",
		},
		footer: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: theme.spacing.md,
			padding: theme.spacing.lg,
		},
	});
