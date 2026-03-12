import "react-native-get-random-values";
import React, { useRef, useCallback } from "react";
import { View, StyleSheet, Alert, Platform } from "react-native";
import { KeyboardAwareFlatList } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";

import { useEventForm } from "../../hooks/eventSubmit/useEventForm";
import { useEventWorkers } from "../../hooks/eventSubmit/useEventWorkers";
import { useEventFormPackages } from "../../hooks/eventSubmit/useEventFormPackages";
import { useEventLabels } from "../../hooks/eventSubmit/useEventLabels";
import { useEventAttachments } from "../../hooks/eventSubmit/useEventAttachments";
import { useEventSubmission } from "../../hooks/eventSubmit/useEventSubmission";

import { EventFormHeader } from "../../components/eventSubmit/EventFormHeader";
import { EventDetailsSection } from "../../components/eventSubmit/EventDetailsSection";
import { DateTimeSection } from "../../components/eventSubmit/DateTimeSection";
import { WorkersSection } from "../../components/eventSubmit/WorkersSection";
import { PackagesSection } from "../../components/eventSubmit/PackagesSection";
import { LabelsSection } from "../../components/eventSubmit/LabelsSection";
import { NotesAttachmentsSection } from "../../components/eventSubmit/NotesAttachmentsSection";
import { FormActionButtons } from "../../components/eventSubmit/FormActionButtons";

import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, BorderRadius, Shadow } from "../../constants/tokens";

const EventSubmit = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const route = useRoute<any>();
	const eventId = route.params?.uid;
	const googlePlacesRef = useRef(null);
	const { theme } = useTheme();

	const { companyId: currentCompany } = useUser();
	const { preferences } = useCompany();

	// Core form state
	const {
		title,
		setTitle,
		date,
		setDate,
		allDay,
		startTime,
		setStartTime,
		hasEndTime,
		endTime,
		setEndTime,
		locations,
		assignedWorkers,
		setAssignedWorkers,
		notes,
		setNotes,
		openSelect,
		openDate,
		openStartTime,
		openEndTime,
		isLoading,
		isEditing,
		editingLabelForAddress,
		setEditingLabelForAddress,
		labelText,
		setLabelText,
		updateLocation,
		deleteLocation,
		setLocationLabel,
		toggleDatePicker,
		toggleAllDay,
		toggleEndTime,
		handleSubmitData,
		handleDelete,
		hasFormChanged,
	} = useEventForm(navigation, eventId);

	// Ancillary hooks
	const { availableWorkers, setAvailableWorkers } = useEventWorkers(
		currentCompany,
		eventId,
		preferences?.enableAvailability,
	);

	const {
		availablePackages,
		selectedPackages,
		loadingPackages,
		openPackagesDropdown,
		setOpenPackagesDropdown,
		togglePackageSelection,
	} = useEventFormPackages(currentCompany, eventId);

	const {
		availableLabels,
		selectedLabelId,
		setSelectedLabelId,
		loadingLabels,
	} = useEventLabels(currentCompany, eventId);

	const {
		attachments,
		setAttachments,
		attachmentDeletionQueue,
		setAttachmentDeletionQueue,
		handleAttachmentSubmit,
		uploadProgress,
		isUploading,
	} = useEventAttachments(currentCompany, eventId, navigation);

	const { handleSubmit } = useEventSubmission({
		companyId: currentCompany,
		title,
		handleSubmitData,
		handleAttachmentSubmit,
		selectedPackages,
		selectedLabelId,
	});

	const handleBackPress = useCallback(() => {
		if (hasFormChanged()) {
			Alert.alert(
				"Discard Changes?",
				"You have unsaved changes. Are you sure you want to go back?",
				[
					{ text: "Keep Editing", style: "cancel" },
					{
						text: "Discard",
						style: "destructive",
						onPress: () => navigation.goBack(),
					},
				],
			);
		} else {
			navigation.goBack();
		}
	}, [hasFormChanged, navigation]);

	return (
		<View
			style={[
				{ flex: 1, paddingTop: insets.top },
				styles.container,
				{ backgroundColor: theme.Background },
			]}
		>
			<KeyboardAwareFlatList
				data={[]}
				renderItem={null}
				ListHeaderComponent={
					<>
						<EventFormHeader
							title={
								isEditing ? "Edit Event" : "Submit New Event"
							}
							onBack={handleBackPress}
						/>

						<View
							style={[
								styles.formCard,
								{ backgroundColor: theme.CardBackground },
							]}
						>
							<EventDetailsSection
								title={title}
								setTitle={setTitle}
								locations={locations}
								onLocationSelect={updateLocation}
								onLocationDelete={deleteLocation}
								onLabelChange={setLocationLabel}
								editingLabelForAddress={editingLabelForAddress}
								setEditingLabelForAddress={
									setEditingLabelForAddress
								}
								labelText={labelText}
								setLabelText={setLabelText}
								googlePlacesRef={googlePlacesRef}
							/>

							<DateTimeSection
								date={date}
								allDay={allDay}
								startTime={startTime}
								hasEndTime={hasEndTime}
								endTime={endTime}
								openDate={openDate}
								openStartTime={openStartTime}
								openEndTime={openEndTime}
								onToggleDatePicker={toggleDatePicker}
								onToggleAllDay={toggleAllDay}
								onToggleEndTime={toggleEndTime}
								onDateChange={setDate}
								onStartTimeChange={setStartTime}
								onEndTimeChange={setEndTime}
							/>

							<WorkersSection
								assignedWorkers={assignedWorkers}
								setAssignedWorkers={setAssignedWorkers}
								availableWorkers={availableWorkers}
								setAvailableWorkers={setAvailableWorkers}
								open={openSelect}
								onToggle={() => toggleDatePicker("select")}
							/>

							<PackagesSection
								availablePackages={availablePackages}
								selectedPackages={selectedPackages}
								loadingPackages={loadingPackages}
								openDropdown={openPackagesDropdown}
								setOpenDropdown={setOpenPackagesDropdown}
								onTogglePackage={togglePackageSelection}
							/>

							<LabelsSection
								availableLabels={availableLabels}
								selectedLabelId={selectedLabelId}
								onSelectLabel={setSelectedLabelId}
								loadingLabels={loadingLabels}
							/>

							<NotesAttachmentsSection
								notes={notes}
								setNotes={setNotes}
								attachments={attachments}
								setAttachments={setAttachments}
								deletionQueue={attachmentDeletionQueue}
								setDeletionQueue={setAttachmentDeletionQueue}
								uploadProgress={uploadProgress}
							/>

							<FormActionButtons
								isEditing={isEditing}
								isLoading={isLoading}
								isUploading={isUploading}
								canSubmit={true}
								onSubmit={handleSubmit}
								onDelete={handleDelete}
							/>
						</View>
					</>
				}
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={styles.scrollContainer}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollContainer: {
		padding: Spacing.lg,
		paddingBottom: 100,
	},
	formCard: {
		borderRadius: BorderRadius.lg,
		...Platform.select({
			ios: {
				shadowColor: "#000",
				shadowOffset: { width: 0, height: 1 },
				shadowOpacity: 0.1,
				shadowRadius: 3,
			},
			android: {
				elevation: 2,
			},
		}),
		marginBottom: Spacing.lg,
		overflow: "hidden",
	},
});

export default EventSubmit;
