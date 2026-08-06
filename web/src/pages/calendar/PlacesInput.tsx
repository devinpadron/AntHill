import { useEffect, useRef, useState } from "react";
import { Icon, Input, Text } from "../../ui";
import styles from "./PlacesInput.module.css";

/*
 * Address autocomplete for event locations.
 *
 * `react-native-google-places-autocomplete` has no web build, so this wraps the
 * Maps JavaScript API's Places service directly. Everything Google-specific is
 * behind this one component: their autocomplete widget has been migrated more
 * than once (legacy `Autocomplete` → `PlaceAutocompleteElement`), and when it
 * moves again only this file changes.
 *
 * ⚠ The key must be a SEPARATE, browser-restricted key — not the mobile
 * GOOGLE_PLACES_API_KEY from .env. A key on a web page is public; restrict it by
 * HTTP referrer to portal.anthillapp.com/* and localhost:5173/*, and to the
 * Maps JavaScript + Places APIs.
 *
 * With no key configured this degrades to a plain address field that still
 * produces a usable location — just without coordinates. That matches the app,
 * which also falls back rather than blocking the form.
 */

export type PickedPlace = {
	address: string;
	latitude: number | null;
	longitude: number | null;
};

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

let loaderPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
	if (!KEY) return Promise.reject(new Error("No Maps key configured"));
	if (loaderPromise) return loaderPromise;

	loaderPromise = new Promise<void>((resolve, reject) => {
		if ((window as never as { google?: unknown }).google) return resolve();
		const script = document.createElement("script");
		script.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places&loading=async`;
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Google Maps failed to load"));
		document.head.appendChild(script);
	});
	return loaderPromise;
}

type Suggestion = { description: string; placeId: string };

export function PlacesInput({
	onPick,
	label = "Add a location",
}: {
	onPick: (place: PickedPlace) => void;
	label?: string;
}) {
	const [value, setValue] = useState("");
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [ready, setReady] = useState(false);
	const [failed, setFailed] = useState(!KEY);
	const serviceRef = useRef<{
		getPlacePredictions: (
			request: unknown,
			callback: (results: unknown[] | null) => void,
		) => void;
	} | null>(null);

	useEffect(() => {
		if (!KEY) return;
		loadMaps()
			.then(() => {
				const google = (window as never as { google: never })
					.google as {
					maps: { places: { AutocompleteService: new () => never } };
				};
				serviceRef.current =
					new google.maps.places.AutocompleteService();
				setReady(true);
			})
			.catch(() => setFailed(true));
	}, []);

	useEffect(() => {
		if (!ready || !serviceRef.current || value.trim().length < 3) {
			setSuggestions([]);
			return;
		}
		const timer = setTimeout(() => {
			serviceRef.current?.getPlacePredictions(
				{ input: value },
				(results) => {
					setSuggestions(
						(
							(results ?? []) as {
								description: string;
								place_id: string;
							}[]
						)
							.slice(0, 5)
							.map((r) => ({
								description: r.description,
								placeId: r.place_id,
							})),
					);
				},
			);
		}, 250); // debounced — Places bills per keystroke otherwise
		return () => clearTimeout(timer);
	}, [value, ready]);

	async function choose(suggestion: Suggestion) {
		setSuggestions([]);
		setValue("");

		try {
			const google = (window as never as { google: never }).google as {
				maps: {
					places: {
						PlacesService: new (el: HTMLElement) => {
							getDetails: (
								req: unknown,
								cb: (place: unknown) => void,
							) => void;
						};
					};
				};
			};
			const service = new google.maps.places.PlacesService(
				document.createElement("div"),
			);
			service.getDetails(
				{
					placeId: suggestion.placeId,
					fields: ["geometry", "formatted_address"],
				},
				(place) => {
					const detail = place as {
						geometry?: {
							location?: { lat(): number; lng(): number };
						};
						formatted_address?: string;
					} | null;
					onPick({
						address:
							detail?.formatted_address ?? suggestion.description,
						latitude: detail?.geometry?.location?.lat() ?? null,
						longitude: detail?.geometry?.location?.lng() ?? null,
					});
				},
			);
		} catch {
			// Detail lookup failed — still record the address, just without
			// coordinates. An address a driver can read beats nothing.
			onPick({
				address: suggestion.description,
				latitude: null,
				longitude: null,
			});
		}
	}

	function addManual() {
		const address = value.trim();
		if (!address) return;
		onPick({ address, latitude: null, longitude: null });
		setValue("");
		setSuggestions([]);
	}

	return (
		<div className={styles.wrap}>
			<Input
				label={label}
				icon="location-outline"
				placeholder={
					failed ? "Type an address" : "Search for an address"
				}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						if (suggestions.length) void choose(suggestions[0]);
						else addManual();
					}
				}}
				suffix={
					value.trim() ? (
						<button
							className={styles.addButton}
							onClick={addManual}
							aria-label="Add this address"
							type="button"
						>
							<Icon name="add" size="sm" />
						</button>
					) : undefined
				}
			/>

			{suggestions.length > 0 && (
				<ul className={styles.suggestions}>
					{suggestions.map((suggestion) => (
						<li key={suggestion.placeId}>
							<button
								type="button"
								className={styles.suggestion}
								onClick={() => void choose(suggestion)}
							>
								<Icon
									name="location-outline"
									size="sm"
									className={styles.dim}
								/>
								{suggestion.description}
							</button>
						</li>
					))}
				</ul>
			)}

			{failed && (
				<Text variant="caption" tone="tertiary">
					Address lookup is off — set VITE_GOOGLE_MAPS_KEY to get
					suggestions and map coordinates. Typed addresses still work.
				</Text>
			)}
		</div>
	);
}
