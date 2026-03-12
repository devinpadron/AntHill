import { useState, useRef, useCallback } from "react";
import { Animated } from "react-native";

/**
 * useUserNotes - Manages the double-tap editing interaction for user notes
 *
 * @param onSave - Callback to save notes when editing is done
 * @returns Editing state, animation value, and interaction handlers
 */
export const useUserNotes = (onSave: () => void) => {
	const [isEditingNotes, setIsEditingNotes] = useState(false);
	const [lastTapTime, setLastTapTime] = useState(0);
	const animatedOpacity = useRef(new Animated.Value(0)).current;

	const handleDoubleTap = useCallback(() => {
		const now = Date.now();
		const DOUBLE_TAP_DELAY = 300; // ms between taps

		if (now - lastTapTime < DOUBLE_TAP_DELAY) {
			// Double tap detected
			setIsEditingNotes(true);

			// Show animation feedback
			Animated.sequence([
				Animated.timing(animatedOpacity, {
					toValue: 1,
					duration: 200,
					useNativeDriver: true,
				}),
				Animated.timing(animatedOpacity, {
					toValue: 0.5,
					duration: 200,
					useNativeDriver: true,
				}),
			]).start();

			// Reset tap timer
			setLastTapTime(0);
		} else {
			// First tap - start timer
			setLastTapTime(now);
		}
	}, [lastTapTime, animatedOpacity]);

	const handleBlur = useCallback(() => {
		onSave();
		setIsEditingNotes(false);
	}, [onSave]);

	return {
		isEditingNotes,
		animatedOpacity,
		handleDoubleTap,
		handleBlur,
	};
};
