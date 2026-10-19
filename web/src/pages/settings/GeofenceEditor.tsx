import { useEffect, useState } from "react";
import type {
	ClockOutReminderTrigger,
	ClockReminderGeofence,
} from "@app/types";
import { Icon, Input, MapCanvas, Text } from "../../ui";
import { PlacesInput } from "../calendar/PlacesInput";
import styles from "./CompanySettingsPage.module.css";

/*
 * Where the clock reminders fire. Mirrors src/components/settings/GeofenceEditor.
 *
 * The address comes from the same Places widget the event editor uses, so the
 * coordinates arrive already resolved. The map preview is not decorative: a
 * radius in metres means nothing to anybody, and an admin who types 100
 * because it sounds tight needs to see that it does not reach their own car
 * park before workers start getting notifications.
 */

/*
 * Below about 100 m consumer GPS drifts across the boundary while the phone
 * sits still on a shelf, and the worker gets reminded to clock in every half
 * hour all afternoon. The ceiling is a sanity bound: past a kilometre the fence
 * covers the neighbourhood and fires on the way past.
 */
const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 1000;

export function GeofenceEditor({
	value,
	onChange,
}: {
	value: ClockReminderGeofence;
	onChange: (next: ClockReminderGeofence) => void;
}) {
	/*
	 * Held locally and committed on blur. Preferences are a live subscription,
	 * so writing per keystroke would publish "1" and "15" on the way to typing
	 * "150" — and every worker's phone would re-register the fence at each.
	 */
	const [radius, setRadius] = useState(String(value.radiusMeters));
	const [label, setLabel] = useState(value.label ?? "");

	useEffect(
		() => setRadius(String(value.radiusMeters)),
		[value.radiusMeters],
	);
	useEffect(() => setLabel(value.label ?? ""), [value.label]);

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

	const hasSite = value.latitude !== null && value.longitude !== null;

	return (
		<div className={styles.geofence}>
			{hasSite ? (
				<div className={styles.site}>
					<Icon name="location-outline" size="sm" />
					<Text variant="body" as="span" clamp={2}>
						{value.address}
					</Text>
					<button
						type="button"
						className={styles.siteClear}
						aria-label="Remove address"
						onClick={() =>
							onChange({
								...value,
								address: null,
								latitude: null,
								longitude: null,
							})
						}
					>
						<Icon name="close" size="sm" />
					</button>
				</div>
			) : (
				<>
					{/* Singular: one site, and the OS caps monitored regions anyway. */}
					<PlacesInput
						label="Your address"
						onPick={(place) => {
							// Without coordinates there is nothing to fence.
							if (
								place.latitude === null ||
								place.longitude === null
							) {
								return;
							}
							onChange({
								...value,
								address: place.address,
								latitude: place.latitude,
								longitude: place.longitude,
							});
						}}
					/>
					<Text variant="caption" tone="warning">
						Search for your address above — until one is set, no
						reminders are sent.
					</Text>
				</>
			)}

			{hasSite && (
				<>
					<div className={styles.durationRow}>
						<Input
							label="Call it"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							onBlur={commitLabel}
							placeholder="the shop"
						/>
						<Input
							label="Radius (m)"
							type="number"
							min={MIN_RADIUS_M}
							max={MAX_RADIUS_M}
							value={radius}
							onChange={(e) => setRadius(e.target.value)}
							onBlur={commitRadius}
							placeholder="150"
						/>
					</div>

					<MapCanvas
						center={{ lat: value.latitude!, lng: value.longitude! }}
						circleMeters={value.radiusMeters}
						markers={[
							{
								position: {
									lat: value.latitude!,
									lng: value.longitude!,
								},
								title: value.label ?? value.address ?? "Site",
							},
						]}
						height={200}
					/>

					<Text variant="label" tone="secondary">
						Remind them to clock out when they
					</Text>
					<div className={styles.choiceRow}>
						{(
							[
								["leaving", "Leave"],
								["returning", "Come back"],
							] as [ClockOutReminderTrigger, string][]
						).map(([trigger, text]) => (
							<button
								key={trigger}
								type="button"
								className={[
									styles.choice,
									value.clockOutTrigger === trigger
										? styles.choiceActive
										: "",
								]
									.filter(Boolean)
									.join(" ")}
								onClick={() =>
									onChange({
										...value,
										clockOutTrigger: trigger,
									})
								}
							>
								<Text variant="bodyStrong" as="span">
									{text}
								</Text>
							</button>
						))}
					</div>

					<Text variant="caption" tone="secondary">
						{value.clockOutTrigger === "leaving"
							? "For work that happens here. Arriving off the clock prompts them to clock in; leaving prompts them to clock out."
							: "For a site crews load up from and return to. Arriving off the clock prompts them to clock in; coming back while still on the clock prompts them to clock out — so nobody is nagged on the way out to a job."}
					</Text>
					<Text variant="caption" tone="tertiary">
						AntHill never clocks anyone in or out by itself.
					</Text>
				</>
			)}
		</div>
	);
}
