import React from "react";
import { StyleSheet } from "react-native";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import { Card } from "../ui/Card";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { MapMarker, openMap } from "../../utils/mapUtils";
import { Spacing, IconSize, BorderRadius } from "../../constants/tokens";

interface LocationCardProps {
	markers: MapMarker[];
	initialRegion: any;
	preferredMapApp: string;
}

/**
 * LocationCard - Displays event location on a map with markers
 */
export const LocationCard: React.FC<LocationCardProps> = ({
	markers,
	initialRegion,
	preferredMapApp,
}) => {
	const { theme } = useTheme();

	if (markers.length === 0 || !initialRegion) return null;

	return (
		<Card padding="md" elevation="md" style={styles.card}>
			<View style={styles.sectionHeaderContainer}>
				<Ionicons
					name="location-outline"
					size={IconSize.sm}
					color={theme.LocationBlue}
					style={styles.icon}
				/>
				<Text variant="body" weight="semibold" color="primary">
					Location
				</Text>
			</View>
			<MapView
				style={styles.map}
				region={initialRegion}
				scrollEnabled={true}
			>
				{markers.map((marker, index) => (
					<Marker
						key={index}
						coordinate={{
							latitude: marker.latitude,
							longitude: marker.longitude,
						}}
						description={marker.label ? marker.title : ""}
						title={marker.label ? marker.label : marker.title}
						onCalloutPress={() =>
							openMap(marker, preferredMapApp, marker.title)
						}
					/>
				))}
			</MapView>
		</Card>
	);
};

const styles = StyleSheet.create({
	card: {
		marginBottom: Spacing.lg,
	},
	sectionHeaderContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: Spacing.md,
	},
	icon: {
		marginRight: Spacing.sm,
	},
	map: {
		height: 220,
		borderRadius: BorderRadius.md,
		overflow: "hidden",
	},
});
