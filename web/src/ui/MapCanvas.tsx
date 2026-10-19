import { useEffect, useRef, useState } from "react";
import { gmaps, loadMaps, mapsLinkFor } from "../lib/googleMaps";
import { Icon } from "./Icon";
import { Text } from "./Text";
import styles from "./MapCanvas.module.css";

/*
 * A read-only Google map with at most one circle and one path on it.
 *
 * The app draws these with react-native-maps, which has no web build. This is
 * the whole of what the portal needs from a map — a geofence preview and a
 * shift route — so it stays one component with a tiny prop surface rather than
 * a wrapper over the Maps API.
 *
 * With no key, or when the script fails, it falls back to a link that opens
 * the same spot in Google Maps. A blank grey tile would look like "no data",
 * which is exactly the misreading the app's TrackMapCard exists to prevent.
 */

export type LatLng = { lat: number; lng: number };

export function MapCanvas({
	center,
	circleMeters,
	path,
	markers = [],
	height = 220,
}: {
	center: LatLng;
	/** Radius of a circle drawn around `center`, in metres. */
	circleMeters?: number;
	/** A polyline, in order. The map fits itself to it when present. */
	path?: LatLng[];
	markers?: { position: LatLng; title: string; color?: string }[];
	height?: number;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		let objects: { setMap(map: unknown): void }[] = [];

		loadMaps()
			.then(() => {
				if (cancelled || !ref.current) return;
				const maps = gmaps();
				const accent = getComputedStyle(document.documentElement)
					.getPropertyValue("--c-accent")
					.trim();

				const map = new maps.Map(ref.current, {
					center,
					zoom: 15,
					disableDefaultUI: true,
					zoomControl: true,
					gestureHandling: "cooperative",
				});

				if (circleMeters) {
					const circle = new maps.Circle({
						map,
						center,
						radius: circleMeters,
						strokeColor: accent,
						strokeWeight: 2,
						fillColor: accent,
						fillOpacity: 0.15,
					});
					objects.push(circle);
					map.fitBounds(circle.getBounds());
				}

				if (path && path.length > 1) {
					const line = new maps.Polyline({
						map,
						path,
						strokeColor: accent,
						strokeWeight: 4,
					});
					objects.push(line);
					const bounds = new maps.LatLngBounds();
					for (const point of path) bounds.extend(point);
					map.fitBounds(bounds);
				}

				for (const marker of markers) {
					objects.push(
						new maps.Marker({
							map,
							position: marker.position,
							title: marker.title,
							icon: marker.color
								? {
										path: maps.SymbolPath.CIRCLE,
										scale: 8,
										fillColor: marker.color,
										fillOpacity: 1,
										strokeColor: "#ffffff",
										strokeWeight: 2,
									}
								: undefined,
						}),
					);
				}
			})
			.catch(() => !cancelled && setFailed(true));

		return () => {
			cancelled = true;
			for (const object of objects) object.setMap(null);
			objects = [];
		};
		// Serialised: callers build these props inline, and a new array each
		// render would tear the map down and rebuild it on every keystroke.
	}, [
		center.lat,
		center.lng,
		circleMeters,
		JSON.stringify(path),
		JSON.stringify(markers),
	]);

	if (failed) {
		return (
			<a
				className={styles.fallback}
				style={{ height }}
				href={mapsLinkFor(center.lat, center.lng)}
				target="_blank"
				rel="noopener noreferrer"
			>
				<Icon name="location-outline" size="md" />
				<Text variant="caption" as="span">
					Open in Google Maps
				</Text>
			</a>
		);
	}

	return <div ref={ref} className={styles.map} style={{ height }} />;
}
