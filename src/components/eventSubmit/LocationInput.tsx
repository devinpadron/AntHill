import React from "react";
import {
	View,
	Text,
	StyleProp,
	StyleSheet,
	TouchableOpacity,
	TextInput,
	ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
/*
 * Aliased, because this file still uses RN's Text for its legacy rows. Only the
 * field label is themed so far — it is the one that sits beside `Input`s and
 * had to match them.
 */
import { Text as ThemedText } from "../ui";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import Constants from "expo-constants";
import { GOOGLE_PLACES_API_KEY } from "@env";
import { Theme, useTheme, useThemedStyles } from "../../theme";

// Use .env for development, EAS environment variables for production
const API_KEY = __DEV__
	? GOOGLE_PLACES_API_KEY
	: Constants.expoConfig?.extra?.GOOGLE_PLACES_API_KEY || "";

/*
 * Address autocomplete silently returns nothing without a key, so say so
 * loudly. The key itself is never logged — this used to print it at module
 * scope on every launch, in release builds too.
 */
if (!API_KEY || API_KEY === "undefined") {
	console.warn(
		"Google Places API key missing — address autocomplete is disabled. " +
			(__DEV__
				? "Set GOOGLE_PLACES_API_KEY in .env."
				: "Check the EAS environment variables."),
	);
}

type Location = {
	[address: string]: {
		latitude: number;
		longitude: number;
		label?: string;
	};
};

type LocationInputProps = {
	locations: Location | null;
	onLocationSelect: (details: any) => string;
	onLocationDelete: (address: string) => void;
	onLabelChange: (address: string, label: string) => void;
	editingLabelForAddress: string;
	setEditingLabelForAddress: (address: string) => void;
	labelText: string;
	setLabelText: (text: string) => void;
	googlePlacesRef: React.RefObject<any>;
	/**
	 * Field heading. Plural by default because the event form takes a list, but
	 * the geofence editor takes exactly one site and "Location(s)" there is a
	 * promise of a feature that does not exist.
	 */
	label?: string;
	/** Placeholder for the search field, for the same reason. */
	placeholder?: string;
	/**
	 * The per-address tag editor — the pricetag button and its inline field.
	 *
	 * Off where the caller names the place itself. The geofence has a single
	 * "Call it" field of its own, and two ways to label one address disagree the
	 * moment somebody uses the other one.
	 */
	allowLabels?: boolean;
	/** Hides the delete button, for a caller that clears the field another way. */
	allowDelete?: boolean;
	/**
	 * Overrides the root spacing.
	 *
	 * The default bottom margin suits the event form, where fields are stacked
	 * with margins. A parent that spaces its children with `gap` needs it zeroed
	 * or the two compound into a gap half again as large as everything else on
	 * the card.
	 */
	containerStyle?: StyleProp<ViewStyle>;
};

const LocationInputComponent = ({
	locations,
	onLocationSelect,
	onLocationDelete,
	onLabelChange,
	editingLabelForAddress,
	setEditingLabelForAddress,
	labelText,
	setLabelText,
	googlePlacesRef,
	label: fieldLabel = "Location(s)",
	placeholder = "Search for a location",
	allowLabels = true,
	allowDelete = true,
	containerStyle,
}: LocationInputProps) => {
	const theme = useTheme();
	const styles = useThemedStyles(locationStyles);
	const [resetKey, setResetKey] = React.useState(0);

	return (
		<View style={[styles.inputContainer, containerStyle]}>
			<ThemedText
				variant="label"
				color="textSecondary"
				style={styles.label}
			>
				{fieldLabel}
			</ThemedText>
			{/*
			 * No paddingTop here, unlike the address rows below which reuse
			 * `locationContainer` for their own spacing. The label already
			 * carries its bottom margin, and having both put 18pt between a
			 * label and its field — four times what `Input` uses, which is why
			 * this field looked unrelated to the ones under it.
			 */}
			<View style={styles.searchRow}>
				<GooglePlacesAutocomplete
					key={resetKey}
					ref={googlePlacesRef}
					placeholder={placeholder}
					onPress={(data, details = null) => {
						if (details) {
							onLocationSelect(details);
							// Force re-render to clear the component
							setResetKey((prev) => prev + 1);
						}
					}}
					query={{
						key: API_KEY,
						language: "en",
					}}
					/*
					 * Every surface this widget draws has to be named
					 * explicitly. Its defaults are a hardcoded white input on a
					 * white dropdown with black text — which is why it was the
					 * one field in the event form that stayed white in dark
					 * mode.
					 */
					styles={{
						textInput: styles.placesTextInput,
						listView: styles.placesListView,
						row: styles.placesRow,
						description: styles.placesDescription,
						separator: styles.placesSeparator,
					}}
					textInputProps={{
						placeholderTextColor: theme.colors.textTertiary,
					}}
					fetchDetails={true}
					enablePoweredByContainer={false}
					onFail={(error) =>
						console.error("Google Places Error:", error)
					}
				/>
			</View>

			{locations &&
				Object.keys(locations).map((address, index) => (
					<React.Fragment key={index}>
						<View style={styles.locationContainer}>
							<Text style={styles.addressText}>{address}</Text>
							<View style={styles.locationButtonContainer}>
								{allowLabels && (
									<TouchableOpacity
										onPress={() => {
											if (
												editingLabelForAddress ===
												address
											) {
												setEditingLabelForAddress("");
												setLabelText("");
											} else {
												setEditingLabelForAddress(
													address,
												);
												setLabelText(
													locations[address]?.label ||
														"",
												);
											}
										}}
										style={styles.addLocationButton}
									>
										<Ionicons
											name={
												editingLabelForAddress ===
												address
													? "pricetag"
													: "pricetag-outline"
											}
											size={24}
											color={theme.colors.textSecondary}
										/>
									</TouchableOpacity>
								)}
								{allowDelete && (
									<TouchableOpacity
										onPress={() =>
											onLocationDelete(address)
										}
										style={styles.deleteButton}
									>
										<Ionicons
											name="trash-outline"
											size={24}
											color={theme.colors.danger}
										/>
									</TouchableOpacity>
								)}
							</View>
						</View>

						{allowLabels && editingLabelForAddress === address ? (
							<View style={styles.labelInputContainer}>
								<TextInput
									style={styles.labelInput}
									placeholder="Enter location label"
									value={labelText}
									onChangeText={setLabelText}
								/>
								<TouchableOpacity
									style={styles.saveLabelButton}
									onPress={() => {
										onLabelChange(address, labelText);
										setEditingLabelForAddress("");
									}}
								>
									<Text style={styles.saveLabelButtonText}>
										Save
									</Text>
								</TouchableOpacity>
							</View>
						) : (
							locations[address].label && (
								<Text style={styles.labelText}>
									"{locations[address].label}"
								</Text>
							)
						)}
					</React.Fragment>
				))}
		</View>
	);
};

const locationStyles = (theme: Theme) =>
	StyleSheet.create({
		inputContainer: {
			marginBottom: theme.spacing.xl,
		},
		/*
		 * Only the margin — the type and colour come from `Text variant="label"`
		 * so this matches `Input`'s label exactly, font-scale cap included.
		 * It was a hand-rolled 16pt/600 with an 8pt margin, so wherever this
		 * component sits beside an Input (the geofence editor puts two right
		 * under it) its heading was visibly bigger and further from its field
		 * than its neighbours'.
		 */
		label: {
			marginBottom: theme.spacing.xs,
		},
		searchRow: {
			flexDirection: "row",
			alignItems: "flex-start",
			gap: theme.spacing.sm,
		},
		locationContainer: {
			flexDirection: "row",
			alignItems: "flex-start",
			gap: theme.spacing.sm,
			paddingTop: theme.spacing.sm,
		},
		addressText: {
			flex: 1,
			fontSize: 14,
			marginRight: 10,
			flexWrap: "wrap",
			color: theme.colors.text,
		},
		locationButtonContainer: {
			flexDirection: "row",
			minWidth: 80,
			justifyContent: "flex-end",
			gap: 8,
		},
		addLocationButton: {
			padding: 5,
		},
		deleteButton: {
			padding: 5,
		},
		labelInputContainer: {
			flexDirection: "row",
			alignItems: "center",
			marginBottom: 5,
			marginTop: 5,
		},
		labelInput: {
			flex: 1,
			height: 40,
			borderColor: theme.colors.border,
			borderWidth: 1,
			borderRadius: 10,
			paddingHorizontal: 15,
			fontSize: 14,
			backgroundColor: theme.colors.surface,
			color: theme.colors.text,
			marginRight: 10,
		},
		saveLabelButton: {
			backgroundColor: theme.colors.accent,
			paddingVertical: 8,
			paddingHorizontal: 12,
			borderRadius: 10,
		},
		saveLabelButtonText: {
			color: theme.colors.onAccent,
			fontSize: 14,
			fontWeight: "600",
		},
		labelText: {
			flex: 1,
			fontSize: 14,
			marginTop: 5,
			marginBottom: 10,
			color: theme.colors.textSecondary,
		},
		placesTextInput: {
			height: 50,
			borderColor: theme.colors.border,
			borderWidth: 1,
			borderRadius: 10,
			paddingHorizontal: 15,
			fontSize: 16,
			backgroundColor: theme.colors.surface,
			color: theme.colors.text,
		},
		placesListView: {
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 10,
			backgroundColor: theme.colors.surface,
			marginTop: 5,
		},
		placesRow: {
			padding: 13,
			height: 44,
			backgroundColor: theme.colors.surface,
		},
		placesDescription: {
			color: theme.colors.text,
		},
		placesSeparator: {
			height: theme.hairlineWidth,
			backgroundColor: theme.colors.border,
		},
	});

// Export with React.memo to prevent unnecessary re-renders
export const LocationInput = React.memo(LocationInputComponent);
