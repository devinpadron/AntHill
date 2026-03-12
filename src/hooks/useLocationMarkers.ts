import { useState, useEffect } from "react";
import { getRegionForMarkers, MapMarker } from "../utils/mapUtils";

/**
 * useLocationMarkers - Processes event locations into map markers and region
 *
 * @param locations - The locations object from the event
 * @returns Markers array and the calculated initial map region
 */
export const useLocationMarkers = (locations: any | undefined) => {
	const [markers, setMarkers] = useState<MapMarker[]>([]);
	const [initialRegion, setInitialRegion] = useState(null);

	// Process location data into markers
	useEffect(() => {
		if (!locations) {
			setMarkers([]);
			return;
		}

		const locationMarkers: MapMarker[] = [];

		for (let location in locations) {
			locationMarkers.push({
				latitude: locations[location].latitude,
				longitude: locations[location].longitude,
				title: location,
				label: locations[location].label,
			});
		}

		setMarkers(locationMarkers);
	}, [locations]);

	// Calculate map region when markers change
	useEffect(() => {
		if (markers.length > 0) {
			setInitialRegion(getRegionForMarkers(markers));
		} else {
			setInitialRegion(null);
		}
	}, [markers]);

	return { markers, initialRegion };
};
