import React from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
}: LocationInputProps) => {
	const theme = useTheme();
	const styles = useThemedStyles(locationStyles);
	const [resetKey, setResetKey] = React.useState(0);

	return (
		<View style={styles.inputContainer}>
			<Text style={styles.label}>Location(s)</Text>
			<View style={styles.locationContainer}>
				<GooglePlacesAutocomplete
					key={resetKey}
					ref={googlePlacesRef}
					placeholder="Search for a location"
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
								<TouchableOpacity
									onPress={() => {
										if (
											editingLabelForAddress === address
										) {
											setEditingLabelForAddress("");
											setLabelText("");
										} else {
											setEditingLabelForAddress(address);
											setLabelText(
												locations[address]?.label || "",
											);
										}
									}}
									style={styles.addLocationButton}
								>
									<Ionicons
										name={
											editingLabelForAddress === address
												? "pricetag"
												: "pricetag-outline"
										}
										size={24}
										color={theme.colors.textSecondary}
									/>
								</TouchableOpacity>
								<TouchableOpacity
									onPress={() => onLocationDelete(address)}
									style={styles.deleteButton}
								>
									<Ionicons
										name="trash-outline"
										size={24}
										color={theme.colors.danger}
									/>
								</TouchableOpacity>
							</View>
						</View>

						{editingLabelForAddress === address ? (
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
			marginBottom: 20,
		},
		label: {
			fontSize: 16,
			marginBottom: 8,
			color: theme.colors.textSecondary,
			fontWeight: "600",
		},
		locationContainer: {
			flexDirection: "row",
			alignItems: "flex-start",
			gap: 10,
			paddingTop: 10,
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
