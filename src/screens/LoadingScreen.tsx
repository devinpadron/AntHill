import React from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { AntHill } from "../constants/colors";

const LoadingScreen = () => {
	return (
		<View style={styles.container}>
			<ActivityIndicator size="large" color={AntHill.Black} />
			<Text style={styles.loadingText}>Loading...</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "white",
	},
	loadingText: {
		marginTop: 10,
		fontSize: 18,
	},
});

export default LoadingScreen;
