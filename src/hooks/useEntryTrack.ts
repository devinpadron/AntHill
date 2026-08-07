import { useEffect, useMemo, useState } from "react";
import { LocationSegment, TrackPoint } from "../types";
import { getSegments, pathDistance } from "../services/locationTrackService";

/*
 * The recorded route for one time entry, ready to draw.
 *
 * Read-only and one-shot: the review screens open an entry that finished hours
 * ago, so a live subscription would buy nothing and cost a listener per entry
 * on a screen that can show a whole week of them.
 */

/** More points than a map view can usefully draw. */
const MAX_RENDERED_POINTS = 1000;

export type EntryTrack = {
	points: TrackPoint[];
	/** Metres, summed across the whole route rather than per segment. */
	distanceMeters: number;
	isLoading: boolean;
};

/**
 * Thins a route down to something a MapView can render.
 *
 * Every nth point, not the first n: dropping the tail would silently redraw a
 * twelve-hour shift as a three-hour one, which is worse than a slightly coarser
 * line. The endpoints are preserved because they are the two points anyone
 * actually looks at.
 */
function downsample(points: TrackPoint[], max: number): TrackPoint[] {
	if (points.length <= max) return points;

	const step = Math.ceil(points.length / max);
	const thinned = points.filter((_, index) => index % step === 0);

	const last = points[points.length - 1];
	if (thinned[thinned.length - 1] !== last) thinned.push(last);
	return thinned;
}

export function useEntryTrack(entryId: string | null): EntryTrack {
	const [segments, setSegments] = useState<LocationSegment[]>([]);
	const [isLoading, setIsLoading] = useState(Boolean(entryId));

	useEffect(() => {
		if (!entryId) {
			setSegments([]);
			setIsLoading(false);
			return;
		}

		let cancelled = false;
		setIsLoading(true);

		getSegments(entryId).then((result) => {
			if (cancelled) return;
			setSegments(result);
			setIsLoading(false);
		});

		return () => {
			cancelled = true;
		};
	}, [entryId]);

	return useMemo(() => {
		/*
		 * Sorted again on the way in. The query orders by `seq`, but a segment
		 * written by a device whose clock had drifted can still land out of
		 * time order within a run, and a polyline drawn from unordered points
		 * is a scribble rather than a route.
		 */
		const points = segments
			.flatMap((segment) => segment.points ?? [])
			.sort((a, b) => a.t - b.t);

		return {
			points: downsample(points, MAX_RENDERED_POINTS),
			/* Measured on the FULL set — thinning is a drawing concern, and
			 * distance computed off a thinned path cuts every corner. */
			distanceMeters: pathDistance(points),
			isLoading,
		};
	}, [segments, isLoading]);
}
