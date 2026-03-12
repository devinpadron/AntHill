import React from "react";
import {
	View,
	ScrollView,
	StyleSheet,
	Platform,
	UIManager,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppHeader } from "../../components/ui/AppHeader";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { EmptyState } from "../../components/ui/EmptyState";
import { ChecklistSection } from "../../components/calendar/ChecklistSection";
import { useEventChecklists } from "../../hooks/useEventChecklists";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing } from "../../constants/tokens";

// Enable LayoutAnimation for Android
if (Platform.OS === "android") {
	if (UIManager.setLayoutAnimationEnabledExperimental) {
		UIManager.setLayoutAnimationEnabledExperimental(true);
	}
}

type EventChecklistsRouteParams = {
	checklistIds: string[];
	eventId: string;
};

const EventChecklists = () => {
	const route = useRoute<any>();
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	const { theme } = useTheme();
	const { checklistIds, eventId } =
		(route.params as EventChecklistsRouteParams) || {};

	const {
		loading,
		checklists,
		itemStates,
		toggleItemState,
		isChecklistComplete,
		getProgressPercentage,
	} = useEventChecklists({ checklistIds, eventId });

	if (loading) {
		return (
			<View
				style={[
					styles.container,
					{
						paddingTop: insets.top,
						backgroundColor: theme.Background,
					},
				]}
			>
				<AppHeader
					title="Loading Checklists"
					onBack={() => navigation.goBack()}
				/>
				<LoadingScreen message="Loading checklists..." />
			</View>
		);
	}

	if (checklists.length === 0) {
		return (
			<View
				style={[
					styles.container,
					{
						paddingTop: insets.top,
						backgroundColor: theme.Background,
					},
				]}
			>
				<AppHeader
					title="Checklists"
					onBack={() => navigation.goBack()}
				/>
				<EmptyState
					icon="list"
					title="No Checklists Available"
					message="No valid checklists were found for this selection."
				/>
			</View>
		);
	}

	return (
		<View
			style={[
				styles.container,
				{ paddingTop: insets.top, backgroundColor: theme.Background },
			]}
		>
			<AppHeader
				title={`Checklists (${checklists.length})`}
				onBack={() => navigation.goBack()}
			/>

			<ScrollView
				style={styles.scrollContainer}
				contentContainerStyle={styles.contentContainer}
				showsVerticalScrollIndicator={true}
			>
				{checklists.map((checklist) => (
					<ChecklistSection
						key={checklist.id}
						checklist={checklist}
						itemStates={itemStates[checklist.id] || {}}
						isComplete={isChecklistComplete(checklist.id)}
						progressPercentage={getProgressPercentage(checklist.id)}
						onToggleItem={toggleItemState}
					/>
				))}
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollContainer: {
		flex: 1,
	},
	contentContainer: {
		padding: Spacing.lg,
		paddingBottom: Spacing.xxl,
	},
});

export default EventChecklists;
