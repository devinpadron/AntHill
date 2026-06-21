import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { Olive } from "../../constants/colors";

interface StatusDotProps {
	color?: string;
	size?: number;
	pulsing?: boolean;
}

/**
 * A small status dot. Optionally pulses with an expanding ring (active timer).
 */
export const StatusDot: React.FC<StatusDotProps> = ({
	color = Olive[500],
	size = 8,
	pulsing = false,
}) => {
	const ring = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!pulsing) return;
		const loop = Animated.loop(
			Animated.timing(ring, {
				toValue: 1,
				duration: 2000,
				useNativeDriver: true,
			}),
		);
		loop.start();
		return () => loop.stop();
	}, [pulsing, ring]);

	const scale = ring.interpolate({
		inputRange: [0, 1],
		outputRange: [1, 2.1],
	});
	const opacity = ring.interpolate({
		inputRange: [0, 1],
		outputRange: [0.4, 0],
	});

	return (
		<View
			style={{
				width: size,
				height: size,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			{pulsing && (
				<Animated.View
					style={{
						position: "absolute",
						width: size,
						height: size,
						borderRadius: size / 2,
						backgroundColor: color,
						transform: [{ scale }],
						opacity,
					}}
				/>
			)}
			<View
				style={{
					width: size,
					height: size,
					borderRadius: size / 2,
					backgroundColor: color,
				}}
			/>
		</View>
	);
};
