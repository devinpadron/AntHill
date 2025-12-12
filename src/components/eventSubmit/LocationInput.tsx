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

// Use .env for development, EAS environment variables for production
const API_KEY = __DEV__
	? GOOGLE_PLACES_API_KEY
	: Constants.expoConfig?.extra?.GOOGLE_PLACES_API_KEY || "";

// Debug: Log if API key is missing (remove this after testing)
if (!API_KEY || API_KEY === "undefined") {
	console.warn("⚠️ Google Places API Key is missing or undefined!");
	console.log("Running in __DEV__ mode:", __DEV__);
	if (!__DEV__) {
		console.log("Available extra config:", Constants.expoConfig?.extra);
	}
} else {
	console.log("✅ Google Places API Key loaded successfully");
	console.log("Source:", __DEV__ ? ".env file" : "EAS environment variables");
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

console.log("API_KEY:", API_KEY);

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
					styles={{
						textInput: styles.placesTextInput,
						listView: styles.placesListView,
						row: styles.placesRow,
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
										color="#555"
									/>
								</TouchableOpacity>
								<TouchableOpacity
									onPress={() => onLocationDelete(address)}
									style={styles.deleteButton}
								>
									<Ionicons
										name="trash-outline"
										size={24}
										color="red"
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

const styles = StyleSheet.create({
	inputContainer: {
		marginBottom: 20,
	},
	label: {
		fontSize: 16,
		marginBottom: 8,
		color: "#555",
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
		borderColor: "#ccc",
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 15,
		fontSize: 14,
		backgroundColor: "white",
		marginRight: 10,
	},
	saveLabelButton: {
		backgroundColor: "#555",
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 10,
	},
	saveLabelButtonText: {
		color: "white",
		fontSize: 14,
		fontWeight: "600",
	},
	labelText: {
		flex: 1,
		fontSize: 14,
		marginTop: 5,
		marginBottom: 10,
	},
	placesTextInput: {
		height: 50,
		borderColor: "#ccc",
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 15,
		fontSize: 16,
		backgroundColor: "white",
	},
	placesListView: {
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 10,
		backgroundColor: "white",
		marginTop: 5,
	},
	placesRow: {
		padding: 13,
		height: 44,
	},
});

// Export with React.memo to prevent unnecessary re-renders
export const LocationInput = React.memo(LocationInputComponent);
