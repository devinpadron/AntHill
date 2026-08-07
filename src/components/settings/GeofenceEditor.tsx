import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import { Input, SegmentedControl, Text } from "../ui";
import { LocationInput } from "../eventSubmit/LocationInput";
import { ClockOutReminderTrigger, ClockReminderGeofence } from "../../types";
import { Theme, useTheme, useThemedStyles } from "../../theme";

/*
 * Where the clock reminders fire.
 *
 * The address comes from the same Google Places widget the event form uses, so
 * there is one autocomplete in the app rather than two, and the coordinates
 * arrive already resolved in `details.geometry.location` — the shape
 * useEventForm.updateLocation consumes.
 *
 * The map preview is not decorative. A radius in metres means nothing to
 * anybody, and an admin who types 100 because it sounds tight needs to see that
 * it does not reach their own car park. Drawing the circle is the only way to
 * make the number mean something before workers start getting notifications.
 */

/*
 * Below about 100 m consumer GPS drifts across the boundary while the phone
 * sits still on a shelf, and the worker gets reminded to clock in every half
 * hour all afternoon. The ceiling is a sanity bound: past a kilometre the fence
 * covers the neighbourhood and fires on the way past.
 */
const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 1000;

type GeofenceEditorProps = {
	value: ClockReminderGeofence;
	onChange: (next: ClockReminderGeofence) => void;
};

export const GeofenceEditor: React.FC<GeofenceEditorProps> = ({
	value,
	onChange,
}) => {
	const styles = useThemedStyles(geofenceStyles);
	const theme = useTheme();
	const googlePlacesRef = React.useRef(null);

	/*
	 * Held locally and committed on blur, like the reminder intervals on this
	 * screen. Preferences are a live subscription, so writing per keystroke
	 * would publish "1" and "15" on the way to typing "150" — and every
	 * worker's phone would re-register the fence at each of them.
	 */
	const [radius, setRadius] = useState(String(value.radiusMeters));
	const [label, setLabel] = useState(value.label ?? "");

	useEffect(() => {
		setRadius(String(value.radiusMeters));
	}, [value.radiusMeters]);

	useEffect(() => {
		setLabel(value.label ?? "");
	}, [value.label]);

	const commitRadius = () => {
		const parsed = parseInt(radius, 10);
		const clamped = Math.min(
			MAX_RADIUS_M,
			Math.max(
				MIN_RADIUS_M,
				Number.isNaN(parsed) ? MIN_RADIUS_M : parsed,
			),
		);
		setRadius(String(clamped));
		if (clamped !== value.radiusMeters) {
			onChange({ ...value, radiusMeters: clamped });
		}
	};

	const commitLabel = () => {
		const trimmed = label.trim();
		if (trimmed === (value.label ?? "")) return;
		onChange({ ...value, label: trimmed || null });
	};

	const selectAddress = (details: any) => {
		const address = details?.formatted_address ?? "";
		const coords = details?.geometry?.location;
		if (!coords) return address;

		onChange({
			...value,
			address,
			latitude: coords.lat,
			longitude: coords.lng,
		});
		return address;
	};

	const clearAddress = () =>
		onChange({ ...value, address: null, latitude: null, longitude: null });

	const hasSite = value.latitude !== null && value.longitude !== null;

	/*
	 * Framed off the radius rather than a fixed zoom, so a 1 km fence and a
	 * 100 m one both fill the preview. ~111 km per degree of latitude; the 3×
	 * leaves the circle comfortably inside its frame.
	 */
	const region = hasSite
		? {
				latitude: value.latitude,
				longitude: value.longitude,
				latitudeDelta: (value.radiusMeters * 3) / 111000,
				longitudeDelta: (value.radiusMeters * 3) / 111000,
			}
		: null;

	return (
		<View style={styles.root}>
			<LocationInput
				locations={
					hasSite && value.address
						? {
								[value.address]: {
									latitude: value.latitude,
									longitude: value.longitude,
									label: value.label ?? undefined,
								},
							}
						: null
				}
				onLocationSelect={selectAddress}
				onLocationDelete={clearAddress}
				/*
				 * Singular, because it is: one site, and the OS caps monitored
				 * regions anyway. "Location(s)" here offered a list the screen
				 * has no way to add a second entry to.
				 */
				label="Your address"
				placeholder="Search for your address"
				/*
				 * The tag editor is off — the "Call it" field below is this
				 * screen's way to name the place, and two label editors for one
				 * address disagree the moment somebody uses the other one.
				 */
				allowLabels={false}
				/* The card spaces its children with `gap`; the component's own
				   bottom margin would land on top of it. */
				containerStyle={styles.noMargin}
				onLabelChange={() => {}}
				editingLabelForAddress=""
				setEditingLabelForAddress={() => {}}
				labelText=""
				setLabelText={() => {}}
				googlePlacesRef={googlePlacesRef}
			/>

			{!hasSite && (
				<Text variant="caption" color="warning">
					Search for your address above — until one is set, no
					reminders are sent.
				</Text>
			)}

			{hasSite && (
				<>
					<View style={styles.fields}>
						<Input
							label="Call it"
							value={label}
							onChangeText={setLabel}
							onBlur={commitLabel}
							placeholder="the shop"
							containerStyle={styles.flex}
						/>
						<Input
							label="Radius (m)"
							value={radius}
							onChangeText={setRadius}
							onBlur={commitRadius}
							keyboardType="number-pad"
							placeholder="150"
							containerStyle={styles.flex}
						/>
					</View>

					{region && (
						<MapView
							style={styles.map}
							region={region}
							scrollEnabled={false}
							zoomEnabled={false}
							pointerEvents="none"
						>
							<Marker
								coordinate={{
									latitude: value.latitude,
									longitude: value.longitude,
								}}
							/>
							<Circle
								center={{
									latitude: value.latitude,
									longitude: value.longitude,
								}}
								radius={value.radiusMeters}
								strokeColor={theme.colors.accent}
								fillColor={theme.colors.accentSubtle}
								strokeWidth={2}
							/>
						</MapView>
					)}

					<View style={styles.triggerBlock}>
						<Text variant="label" color="textSecondary">
							Remind them to clock out when they
						</Text>
						<SegmentedControl<ClockOutReminderTrigger>
							segments={[
								{ value: "leaving", label: "Leave" },
								{ value: "returning", label: "Come back" },
							]}
							value={value.clockOutTrigger}
							onChange={(clockOutTrigger) =>
								onChange({ ...value, clockOutTrigger })
							}
						/>
					</View>

					<Text variant="caption" color="textSecondary">
						{value.clockOutTrigger === "leaving"
							? "For work that happens here. Arriving off the clock prompts them to clock in; leaving prompts them to clock out."
							: "For a site crews load up from and return to. Arriving off the clock prompts them to clock in; coming back while still on the clock prompts them to clock out — so nobody is nagged on the way out to a job."}
					</Text>

					<Text variant="caption" color="textTertiary">
						AntHill never clocks anyone in or out by itself.
					</Text>
				</>
			)}
		</View>
	);
};

const geofenceStyles = (theme: Theme) =>
	StyleSheet.create({
		root: {
			paddingHorizontal: theme.spacing.lg,
			/*
			 * This block is revealed under the row whose switch opened it, and
			 * with no top padding it started flush against that row's separator
			 * — so the address field read as belonging to the row below it
			 * rather than the one that turned it on.
			 */
			paddingTop: theme.spacing.md,
			paddingBottom: theme.spacing.lg,
			gap: theme.spacing.md,
		},
		fields: {
			flexDirection: "row",
			gap: theme.spacing.md,
		},
		triggerBlock: {
			gap: theme.spacing.sm,
		},
		noMargin: {
			marginBottom: 0,
		},
		flex: {
			flex: 1,
		},
		map: {
			height: 180,
			width: "100%",
			borderRadius: theme.radius.md,
			overflow: "hidden",
		},
	});
