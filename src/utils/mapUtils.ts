import { Platform, Linking } from "react-native";

export type MapMarker = {
	latitude: number;
	longitude: number;
	title: string;
	label?: string;
};

export const getRegionForMarkers = (markers: MapMarker[]) => {
	if (!markers || markers.length === 0) return null;

	if (markers.length === 1) {
		return {
			latitude: markers[0].latitude,
			longitude: markers[0].longitude,
			latitudeDelta: 0.01 * 1.5,
			longitudeDelta: 0.01 * 1.5,
		};
	}

	// Initialize with first marker
	let minLat = markers[0].latitude;
	let maxLat = markers[0].latitude;
	let minLng = markers[0].longitude;
	let maxLng = markers[0].longitude;

	// Find min/max values
	markers.forEach((marker) => {
		minLat = Math.min(minLat, marker.latitude);
		maxLat = Math.max(maxLat, marker.latitude);
		minLng = Math.min(minLng, marker.longitude);
		maxLng = Math.max(maxLng, marker.longitude);
	});

	// Calculate center and deltas
	const centerLat = (minLat + maxLat) / 2;
	const centerLng = (minLng + maxLng) / 2;
	const latDelta = (maxLat - minLat) * 1.5; // 1.5 adds 50% padding
	const lngDelta = (maxLng - minLng) * 1.5;

	return {
		latitude: centerLat,
		longitude: centerLng,
		latitudeDelta: latDelta,
		longitudeDelta: lngDelta,
	};
};

export const openMap = ({ latitude, longitude, label }: MapMarker) => {
	if (!label) {
		label = "Event";
	}
	const scheme = Platform.select({
		ios: `maps://?q=${label}&ll=${latitude},${longitude}`,
		android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
	});

	if (scheme) {
		Linking.openURL(scheme).catch((err) =>
			console.error("Error opening map: ", err),
		);
	}
};
