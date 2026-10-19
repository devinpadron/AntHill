/*
 * One loader for the Maps JavaScript API.
 *
 * Both the address autocomplete (PlacesInput) and the map previews (MapCanvas)
 * need the same script, and loading it twice is an error on Google's side —
 * so the promise is shared and the script tag is appended once.
 *
 * ⚠ The key must be a SEPARATE, browser-restricted key — not the mobile
 * GOOGLE_PLACES_API_KEY from .env. A key on a web page is public; restrict it by
 * HTTP referrer to portal.anthillapp.com/* and localhost:5173/*, and to the
 * Maps JavaScript + Places APIs.
 *
 * With no key configured the promise rejects and callers degrade: the address
 * field becomes plain text, and maps give way to a link that opens Google Maps.
 */

export const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as
	string | undefined;

let loaderPromise: Promise<void> | null = null;

export function loadMaps(): Promise<void> {
	if (!MAPS_KEY) return Promise.reject(new Error("No Maps key configured"));
	if (loaderPromise) return loaderPromise;

	loaderPromise = new Promise<void>((resolve, reject) => {
		if ((window as never as { google?: unknown }).google) return resolve();
		const script = document.createElement("script");
		script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&loading=async`;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Google Maps failed to load"));
		document.head.appendChild(script);
	});
	return loaderPromise;
}

/** The global the script installs. Typed loosely: @types/google.maps is not a dependency. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const gmaps = (): any =>
	(window as never as { google: any }).google.maps;

/** A link that opens the point in Google Maps, for when the map itself cannot load. */
export const mapsLinkFor = (latitude: number, longitude: number) =>
	`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
