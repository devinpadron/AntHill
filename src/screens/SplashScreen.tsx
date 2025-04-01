import React, { useEffect, useState } from "react";
import { View, Image, Text, StyleSheet, Animated } from "react-native";

interface SplashScreenProps {
	onComplete?: () => void;
	duration?: number;
	logoSource?: any;
	appName?: string;
}

const SplashScreen: React.FC<SplashScreenProps> = ({
	onComplete,
	duration = 2000,
	logoSource,
	appName = "AntHill",
}) => {
	const [opacity] = useState(new Animated.Value(1));

	useEffect(() => {
		const timer = setTimeout(() => {
			Animated.timing(opacity, {
				toValue: 0,
				duration: 500,
				useNativeDriver: true,
			}).start(() => {
				if (onComplete) {
					onComplete();
				}
			});
		}, duration);

		return () => clearTimeout(timer);
	}, [duration, opacity, onComplete]);

	return (
		<Animated.View style={[styles.container, { opacity }]}>
			<Image
				source={
					logoSource || require("../assets/AntHill/Full_Black.png")
				}
				style={styles.logo}
				resizeMode="contain"
			/>
			<Text style={styles.title}>{appName}</Text>
			<View style={styles.loadingContainer}>
				<Text style={styles.loadingText}>Loading...</Text>
			</View>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#ffffff",
	},
	logo: {
		width: 150,
		height: 150,
		marginBottom: 20,
	},
	title: {
		fontSize: 32,
		fontWeight: "bold",
		marginBottom: 20,
		color: "#333",
	},
	loadingContainer: {
		marginTop: 20,
	},
	loadingText: {
		fontSize: 16,
		color: "#666",
	},
});

export default SplashScreen;
