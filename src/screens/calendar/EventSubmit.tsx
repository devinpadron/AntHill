import "react-native-get-random-values";
import React, { useRef, useEffect, useState } from "react";
import {
	View,
	Text,
	TextInput,
	StyleSheet,
	TouchableOpacity,
	Alert,
	Platform,
	ActivityIndicator,
} from "react-native";
import { KeyboardAwareFlatList } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import DatePicker from "react-native-date-picker";
import DropDownPicker from "react-native-dropdown-picker";
import moment from "moment";
import { subscribeAllUsersInCompany } from "../../services/companyService";
import { getUser } from "../../services/userService";
import { useEventForm } from "../../hooks/useEventForm";
import { EventFormHeader } from "../../components/eventSubmit/EventFormHeader";
import { LocationInput } from "../../components/eventSubmit/LocationInput";
import { useUser } from "../../contexts/UserContext";
import { Button } from "../../components/ui/Button";
import AttachmentsSelector from "../../components/ui/AttachmentsSelector";
import { AttachmentItem } from "../../types";
import { useUploadManager } from "../../contexts/UploadManagerContext";
import { getEventAttachments, updateEvent } from "../../services/eventService";
import { getEventPackages, getPackages } from "../../services/packageService";
import db from "../../constants/firestore";
import { getWorkerStatusList } from "../../services/availabilityService";
import { useCompany } from "../../contexts/CompanyContext";

const EventSubmit = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const route = useRoute<any>();
	const eventId = route.params?.uid;
	const googlePlacesRef = useRef(null);

	// Use our custom hook for form state management
	const {
		// Form state
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

		// UI state
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

		// Methods
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

	const { companyId: currentCompany } = useUser();
	const { uploadFiles, deleteFiles, isUploading, uploadProgress } =
		useUploadManager();
	const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
	const [attachmentDeletionQueue, setAttachmentDeletionQueue] = useState<
		string[]
	>([]);
	const [availablePackages, setAvailablePackages] = useState([]);
	const [selectedPackages, setSelectedPackages] = useState([]);
	const [ogSelectedPackages, setOgSelectedPackages] = useState([]);
	const [loadingPackages, setLoadingPackages] = useState(false);

	// Add these after your other state declarations
	const [availableLabels, setAvailableLabels] = useState([]);
	const [selectedLabelId, setSelectedLabelId] = useState(null);
	const [loadingLabels, setLoadingLabels] = useState(false);
	const [openLabelsDropdown, setOpenLabelsDropdown] = useState(false);
	const [availableWorkers, setAvailableWorkers] = useState([]);

	const { preferences } = useCompany();

	// Add these at the top of your component
	const isMounted = useRef(true);

	console.log(availableWorkers);

	// Add at the beginning of the component
	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, []);

	const sortWorkersByStatus = (workers, workerStatus) => {
		if (!workers.length) return workers;

		return workers.sort((a, b) => {
			// Get status from workerStatus map, default to "pending" if not found
			const statusA = workerStatus
				? workerStatus[a.value] || "pending"
				: "pending";
			const statusB = workerStatus
				? workerStatus[b.value] || "pending"
				: "pending";

			// Define priority order: confirmed -> pending -> declined
			const statusPriority = { confirmed: 0, pending: 1, declined: 2 };

			// Sort by status priority first
			const priorityDiff =
				statusPriority[statusA] - statusPriority[statusB];

			// If same priority, sort alphabetically by name
			if (priorityDiff === 0) {
				const nameA = a.userData
					? `${a.userData.firstName} ${a.userData.lastName}`
					: a.label;
				const nameB = b.userData
					? `${b.userData.firstName} ${b.userData.lastName}`
					: b.label;
				return nameA.localeCompare(nameB);
			}

			return priorityDiff;
		});
	};

	// Load available workers
	useEffect(() => {
		if (!currentCompany) return;

		const subscriber = subscribeAllUsersInCompany(
			currentCompany,
			async (snapshot) => {
				const workers = await Promise.all(
					snapshot.docs.map(async (doc) => {
						const userData = await getUser(doc.id);
						return {
							label: `${userData.firstName} ${userData.lastName}`,
							value: doc.id,
							userData: userData,
						};
					}),
				);

				// If editing an event, fetch worker status and enhance labels for ALL workers
				if (eventId && preferences.enableAvailability == true) {
					try {
						const workerStatus = await getWorkerStatusList(
							currentCompany,
							eventId,
						);

						// Enhance labels with status indicators for ALL workers
						const enhancedWorkers = workers.map((worker) => {
							// Get status - if not in workerStatus map, it's "pending"
							const status =
								workerStatus[worker.value] || "pending";
							const statusEmoji = {
								confirmed: "✅",
								pending: "⏳",
								declined: "❌",
							};

							return {
								...worker,
								label: `${statusEmoji[status]} ${worker.userData.firstName} ${worker.userData.lastName}`,
								status: status, // Add status to the worker object for easier filtering
							};
						});

						// Sort all relevant workers by status priority
						const sortedWorkers = sortWorkersByStatus(
							enhancedWorkers,
							workerStatus,
						);

						setAvailableWorkers(sortedWorkers); // Show all workers in dropdown, but with status indicators
					} catch (error) {
						console.error(
							"Error fetching worker status for sorting:",
							error,
						);
						setAvailableWorkers(workers);
					}
				} else {
					setAvailableWorkers(workers);
				}
			},
		);

		return () => subscriber();
	}, [currentCompany, eventId]); // Remove assignedWorkers from dependencies

	// Load packages
	useEffect(() => {
		if (!currentCompany) return;

		const fetchPackagesData = async () => {
			setLoadingPackages(true);
			try {
				const packages = await getPackages(currentCompany);
				setAvailablePackages(packages);

				// If editing an event, load attached packages
				if (eventId) {
					const eventPackages = await getEventPackages(
						currentCompany,
						eventId,
					);
					if (eventPackages && eventPackages.length > 0) {
						setSelectedPackages(eventPackages);
						setOgSelectedPackages(eventPackages);
					}
				}
			} catch (error) {
				console.error("Error loading packages:", error);
			} finally {
				setLoadingPackages(false);
			}
		};

		fetchPackagesData();
	}, [currentCompany, eventId]);

	// Add this useEffect after your other useEffects
	useEffect(() => {
		if (!currentCompany) return;

		const fetchLabels = async () => {
			setLoadingLabels(true);
			try {
				const labelsRef = db
					.collection("Companies")
					.doc(currentCompany)
					.collection("EventLabels");

				const snapshot = await labelsRef.get();
				const labelData = snapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}));

				setAvailableLabels(labelData);

				// If editing and event has a label, set it
				if (eventId) {
					const eventDoc = await db
						.collection("Companies")
						.doc(currentCompany)
						.collection("Events")
						.doc(eventId)
						.get();

					if (eventDoc.exists && eventDoc.data().labelId) {
						setSelectedLabelId(eventDoc.data().labelId);
					}
				}
			} catch (error) {
				console.error("Error fetching labels:", error);
			} finally {
				setLoadingLabels(false);
			}
		};

		fetchLabels();
	}, [currentCompany, eventId]);

	const formatDate = (date: Date) => moment(date).format("MMM D, YYYY");
	const formatTime = (time: Date, start: boolean = true) => {
		if (start) return moment(time).format("h:mm A");
		return moment(time).format("MMMM D, h:mm A");
	};

	// Load attachments if editing an event
	useEffect(() => {
		if (eventId) {
			const fetchAttachments = async () => {
				const attachments = await getEventAttachments(
					currentCompany,
					eventId,
				);

				setAttachments(attachments);
			};

			fetchAttachments();
		}
	}, [eventId, currentCompany]);

	const canSubmit = () => {
		return true;
	};

	const handleBackPress = () => {
		if (hasFormChanged()) {
			Alert.alert(
				"Discard Changes?",
				"You have unsaved changes. Are you sure you want to go back?",
				[
					{
						text: "Keep Editing",
						style: "cancel",
					},
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
	};

	const handleAttachmentSubmit = async (eventId) => {
		try {
			if (!isMounted.current) return;

			if (!eventId || !currentCompany) {
				Alert.alert(
					"Error",
					"Unable to save event information. Please try again.",
				);
				return;
			}

			// Validate attachments before proceeding
			const validAttachments = attachments.filter((att) =>
				att.uri
					? att.uri.startsWith("file://") ||
						att.uri.startsWith("http")
					: false,
			);

			if (validAttachments.length !== attachments.length) {
				console.warn(
					`Found ${
						attachments.length - validAttachments.length
					} invalid attachments`,
				);
			}

			// First delete any files in the deletion queue
			if (attachmentDeletionQueue.length > 0) {
				await deleteFiles(
					attachmentDeletionQueue,
					currentCompany,
					eventId,
					"Events",
				);
			}

			// Then upload any new files
			if (validAttachments.length > 0) {
				const uploadedAttachments = await uploadFiles(
					validAttachments,
					currentCompany,
					eventId,
					"Events",
				);

				// Update state with uploaded attachments (uncomment and fix this)
				if (uploadedAttachments && uploadedAttachments.length > 0) {
					const existingAttachments = attachments.filter(
						(att) => att.isExisting,
					);
					setAttachments([
						...existingAttachments,
						...uploadedAttachments,
					]);
				}
			}

			// Clear deletion queue
			setAttachmentDeletionQueue([]);

			// Only navigate after all operations are complete
			if (isMounted.current) {
				navigation.pop();
			}
		} catch (error) {
			console.error("Error handling attachments:", error);
			Alert.alert(
				"Upload Error",
				"There was an error uploading attachments. Please try again.",
			);
		}
	};

	const handleSubmit = async () => {
		const eventId = await handleSubmitData();

		handleAttachmentSubmit(eventId);

		await updateEvent(currentCompany, eventId, {
			packages: selectedPackages,
			labelId: selectedLabelId,
		});
	};

	// Toggle package selection
	const togglePackageSelection = (packageId) => {
		if (selectedPackages.includes(packageId)) {
			setSelectedPackages(
				selectedPackages.filter((id) => id !== packageId),
			);
		} else {
			setSelectedPackages([...selectedPackages, packageId]);
		}
	};

	// Add this state for dropdown control
	const [openPackagesDropdown, setOpenPackagesDropdown] = useState(false);
	return (
		<View style={[{ flex: 1, paddingTop: insets.top }, styles.container]}>
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

						{/* Form Container */}
						<View style={styles.formCard}>
							{/* Title Section */}
							<View style={styles.sectionContainer}>
								<Text style={styles.sectionTitle}>
									Event Details
								</Text>
								<View style={styles.inputContainer}>
									<Text style={styles.label}>Title</Text>
									<TextInput
										style={styles.input}
										placeholder="Enter Title"
										value={title}
										onChangeText={setTitle}
										placeholderTextColor="#A0A0A0"
									/>
								</View>

								{/* Location Section */}
								<LocationInput
									locations={locations}
									onLocationSelect={updateLocation}
									onLocationDelete={deleteLocation}
									onLabelChange={setLocationLabel}
									editingLabelForAddress={
										editingLabelForAddress
									}
									setEditingLabelForAddress={
										setEditingLabelForAddress
									}
									labelText={labelText}
									setLabelText={setLabelText}
									googlePlacesRef={googlePlacesRef}
								/>
							</View>

							{/* Date & Time Section */}
							<View style={styles.sectionContainer}>
								<Text style={styles.sectionTitle}>
									Date & Time
								</Text>

								{/* Date Toggle */}
								<View style={styles.inputContainer}>
									<Text style={styles.label}>Date</Text>
									<TouchableOpacity
										onPress={() => toggleDatePicker("date")}
										style={styles.dateButton}
									>
										<Text style={styles.dateButtonText}>
											{formatDate(date)}
										</Text>
										<Ionicons
											name="calendar-outline"
											size={22}
											color="#555"
										/>
									</TouchableOpacity>
									<DatePicker
										modal
										open={openDate}
										date={date}
										mode="date"
										onConfirm={(date) => {
											toggleDatePicker("date");
											setDate(date);
										}}
										onCancel={() => {
											toggleDatePicker("date");
										}}
									/>
								</View>

								<View style={styles.checkboxWrapper}>
									<TouchableOpacity
										onPress={toggleAllDay}
										style={styles.checkboxContainer}
									>
										<View style={styles.checkbox}>
											<Ionicons
												name={
													allDay
														? "checkbox"
														: "square-outline"
												}
												size={24}
												color="#3d7eea"
											/>
										</View>
										<Text style={styles.checkboxLabel}>
											All Day
										</Text>
									</TouchableOpacity>
								</View>

								{!allDay && (
									<View style={styles.timeContainer}>
										{/* Start Time Section */}
										<View
											style={[
												styles.inputContainer,
												styles.timeField,
											]}
										>
											<Text style={styles.label}>
												Start Time
											</Text>
											<TouchableOpacity
												onPress={() =>
													toggleDatePicker(
														"startTime",
													)
												}
												style={styles.dateButton}
											>
												<Text
													style={
														styles.dateButtonText
													}
												>
													{formatTime(startTime)}
												</Text>
												<Ionicons
													name="time-outline"
													size={22}
													color="#555"
												/>
											</TouchableOpacity>
											<DatePicker
												modal
												open={openStartTime}
												date={startTime}
												mode="time"
												onConfirm={(date) => {
													toggleDatePicker(
														"startTime",
													);
													setStartTime(date);
												}}
												onCancel={() => {
													toggleDatePicker(
														"startTime",
													);
												}}
											/>
										</View>

										{/* End Time Toggle */}
										<View style={styles.checkboxWrapper}>
											<TouchableOpacity
												onPress={toggleEndTime}
												style={styles.checkboxContainer}
											>
												<View style={styles.checkbox}>
													<Ionicons
														name={
															hasEndTime
																? "checkbox"
																: "square-outline"
														}
														size={24}
														color="#3d7eea"
													/>
												</View>
												<Text
													style={styles.checkboxLabel}
												>
													End Time
												</Text>
											</TouchableOpacity>
										</View>

										{hasEndTime && (
											<View
												style={[
													styles.inputContainer,
													styles.timeField,
												]}
											>
												<Text style={styles.label}>
													End Time
												</Text>
												<TouchableOpacity
													onPress={() =>
														toggleDatePicker(
															"endTime",
														)
													}
													style={styles.dateButton}
												>
													<Text
														style={
															styles.dateButtonText
														}
													>
														{formatTime(
															endTime,
															false,
														)}
													</Text>
													<Ionicons
														name="time-outline"
														size={22}
														color="#555"
													/>
												</TouchableOpacity>
												<DatePicker
													modal
													open={openEndTime}
													date={endTime}
													mode="datetime"
													onConfirm={(date) => {
														toggleDatePicker(
															"endTime",
														);
														setEndTime(date);
													}}
													onCancel={() => {
														toggleDatePicker(
															"endTime",
														);
													}}
												/>
											</View>
										)}
									</View>
								)}
							</View>

							{/* Assigned Workers Section */}
							<View style={styles.sectionContainer}>
								<Text style={styles.sectionTitle}>People</Text>
								<View
									style={[
										styles.inputContainer,
										{ zIndex: 3000, elevation: 3 },
									]}
								>
									<Text style={styles.label}>
										Assigned Workers
									</Text>
									<DropDownPicker
										searchPlaceholder="Search workers"
										multiple={true}
										min={0}
										max={5}
										value={assignedWorkers}
										setValue={setAssignedWorkers}
										items={availableWorkers}
										setItems={setAvailableWorkers}
										open={openSelect}
										setOpen={() =>
											toggleDatePicker("select")
										}
										mode="BADGE"
										listMode="SCROLLVIEW"
										searchable={true}
										maxHeight={200}
										style={styles.dropdown}
										dropDownContainerStyle={
											styles.dropdownList
										}
										listItemContainerStyle={
											styles.dropdownItem
										}
										badgeColors={["#3d7eea"]}
										badgeTextStyle={{ color: "white" }}
										zIndex={3000}
										placeholder="Select workers"
									/>
								</View>
							</View>

							{/* Packages Section */}
							<View
								style={[styles.sectionContainer, { zIndex: 2 }]}
							>
								<Text style={styles.sectionTitle}>
									Packages
								</Text>
								<View style={styles.inputContainer}>
									<Text style={styles.label}>
										Attach Packages
									</Text>
									<Text style={styles.helperText}>
										Select packages to attach to this event
									</Text>

									{loadingPackages ? (
										<ActivityIndicator
											style={{ marginVertical: 20 }}
										/>
									) : availablePackages.length === 0 ? (
										<View
											style={
												styles.emptyPackagesContainer
											}
										>
											<Text
												style={styles.emptyPackagesText}
											>
												No packages available
											</Text>
										</View>
									) : (
										<>
											{/* Package Dropdown Selector */}
											<DropDownPicker
												open={openPackagesDropdown}
												setOpen={
													setOpenPackagesDropdown
												}
												items={availablePackages.map(
													(pkg) => ({
														label: pkg.title, // Just use the package title as the label
														value: pkg.id,
													}),
												)}
												value={[]} // Use null for single selection mode
												setValue={(callback) => {
													// Keep this empty as we handle selection manually
												}}
												multiple={false}
												searchable={true}
												searchPlaceholder="Search packages..."
												placeholder="Select a package"
												style={styles.dropdown}
												dropDownContainerStyle={
													styles.dropdownList
												}
												listItemContainerStyle={
													styles.dropdownItem
												}
												listMode="SCROLLVIEW" // Add this to ensure scrolling works
												maxHeight={300} // Set a reasonable max height
												onSelectItem={(item) => {
													if (
														item &&
														!selectedPackages.includes(
															item.value,
														)
													) {
														togglePackageSelection(
															item.value,
														);
													}
													setOpenPackagesDropdown(
														false,
													);
												}}
												zIndex={2000}
											/>

											{/* Display Selected Packages */}
											{selectedPackages.length > 0 && (
												<View
													style={
														styles.selectedPackagesContainer
													}
												>
													<Text
														style={
															styles.selectedPackagesTitle
														}
													>
														Selected Packages (
														{
															selectedPackages.length
														}
														)
													</Text>
													{availablePackages
														.filter((pkg) =>
															selectedPackages.includes(
																pkg.id,
															),
														)
														.map((pkg) => (
															<View
																key={pkg.id}
																style={
																	styles.packageItem
																}
															>
																<View
																	style={
																		styles.packageItemContent
																	}
																>
																	<View
																		style={
																			styles.packageItemHeader
																		}
																	>
																		<Text
																			style={
																				styles.packageItemTitle
																			}
																		>
																			{
																				pkg.title
																			}
																		</Text>
																		<TouchableOpacity
																			onPress={() =>
																				togglePackageSelection(
																					pkg.id,
																				)
																			}
																			style={
																				styles.removePackageButton
																			}
																		>
																			<Ionicons
																				name="close-circle"
																				size={
																					24
																				}
																				color="#e74c3c"
																			/>
																		</TouchableOpacity>
																	</View>

																	{pkg.description ? (
																		<Text
																			style={
																				styles.packageItemDescription
																			}
																			numberOfLines={
																				2
																			}
																		>
																			{
																				pkg.description
																			}
																		</Text>
																	) : null}

																	<Text
																		style={
																			styles.packageItemStats
																		}
																	>
																		{
																			pkg
																				.checklists
																				.length
																		}{" "}
																		{pkg
																			.checklists
																			.length ===
																		1
																			? "checklist"
																			: "checklists"}
																	</Text>
																</View>
															</View>
														))}
												</View>
											)}
										</>
									)}
								</View>
							</View>

							{/* Label Section */}
							<View
								style={[styles.sectionContainer, { zIndex: 1 }]}
							>
								<Text style={styles.sectionTitle}>Label</Text>
								<View style={styles.inputContainer}>
									<Text style={styles.label}>
										Event Label
									</Text>
									<Text style={styles.helperText}>
										Categorize this event with a label
									</Text>

									{loadingLabels ? (
										<ActivityIndicator
											style={{ marginVertical: 10 }}
										/>
									) : availableLabels.length === 0 ? (
										<View
											style={styles.emptyLabelsContainer}
										>
											<Text
												style={styles.emptyLabelsText}
											>
												No labels available
											</Text>
										</View>
									) : (
										<View
											style={
												styles.labelSelectorContainer
											}
										>
											<View style={styles.labelsGrid}>
												{/* Option for no label */}
												<TouchableOpacity
													style={[
														styles.labelOption,
														!selectedLabelId &&
															styles.labelOptionSelected,
													]}
													onPress={() =>
														setSelectedLabelId(null)
													}
												>
													<View
														style={
															styles.labelColorNone
														}
													>
														<Ionicons
															name="close"
															size={16}
															color="#999"
														/>
													</View>
													<Text
														style={
															styles.labelOptionText
														}
													>
														None
													</Text>
												</TouchableOpacity>

												{/* Available labels */}
												{availableLabels.map(
													(label) => (
														<TouchableOpacity
															key={label.id}
															style={[
																styles.labelOption,
																selectedLabelId ===
																	label.id &&
																	styles.labelOptionSelected,
															]}
															onPress={() =>
																setSelectedLabelId(
																	label.id,
																)
															}
														>
															<View
																style={[
																	styles.labelColor,
																	{
																		backgroundColor:
																			label.color,
																	},
																]}
															/>
															<Text
																style={
																	styles.labelOptionText
																}
															>
																{label.name}
															</Text>
														</TouchableOpacity>
													),
												)}
											</View>
										</View>
									)}

									{/* Selected Label Preview */}
									{selectedLabelId && (
										<View
											style={
												styles.selectedLabelContainer
											}
										>
											{availableLabels.map((label) => {
												if (
													label.id === selectedLabelId
												) {
													return (
														<View
															key={label.id}
															style={[
																styles.selectedLabel,
																{
																	backgroundColor:
																		label.color,
																},
															]}
														>
															<Text
																style={
																	styles.selectedLabelText
																}
															>
																{label.name}
															</Text>
														</View>
													);
												}
												return null;
											})}
										</View>
									)}
								</View>
							</View>

							{/* Notes Section */}
							<View
								style={[styles.sectionContainer, { zIndex: 1 }]}
							>
								<Text style={styles.sectionTitle}>
									Additional Information
								</Text>
								<View style={styles.inputContainer}>
									<Text style={styles.label}>Notes</Text>
									<TextInput
										style={styles.notesInput}
										placeholder="Add any additional notes about this event"
										placeholderTextColor="#A0A0A0"
										multiline={true}
										numberOfLines={4}
										value={notes}
										onChangeText={setNotes}
									/>
								</View>

								{/* Attachments Section */}
								<View style={styles.attachmentsContainer}>
									<Text style={styles.label}>
										Attachments
									</Text>
									<AttachmentsSelector
										showDocuments={true}
										showMedia={true}
										attachments={attachments}
										setAttachments={setAttachments}
										deletionQueue={attachmentDeletionQueue}
										setDeletionQueue={
											setAttachmentDeletionQueue
										}
										uploadProgress={uploadProgress}
									/>
								</View>
							</View>
						</View>

						{/* Action Buttons */}
						<View style={styles.actionButtonsContainer}>
							<Button
								title={
									isEditing ? "Update Event" : "Create Event"
								}
								onPress={() => {
									// Validate before submitting
									if (!title.trim()) {
										Alert.alert(
											"Error",
											"Please enter a title for the event",
										);
										return;
									}

									handleSubmit();
								}}
								style={styles.submitButton}
								textStyle={styles.submitButtonText}
								variant="primary"
								fullWidth
								loading={isLoading || isUploading}
								disabled={
									(isEditing && !canSubmit()) ||
									isUploading ||
									isLoading
								}
								icon={
									<Ionicons
										name="send"
										size={22}
										color="white"
									/>
								}
							/>

							{isEditing && (
								<Button
									title="Delete Event"
									onPress={handleDelete}
									style={styles.deleteButton}
									textStyle={styles.submitButtonText}
									variant="destructive"
									fullWidth
									icon={
										<Ionicons
											name="trash-outline"
											size={22}
											color="white"
										/>
									}
								/>
							)}
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
		backgroundColor: "#f8f9fa",
	},
	scrollContainer: {
		padding: 16,
		paddingBottom: 100,
	},
	formCard: {
		backgroundColor: "white",
		borderRadius: 12,
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
		marginBottom: 16,
		overflow: "hidden",
	},
	sectionContainer: {
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#333",
		marginBottom: 16,
	},
	inputContainer: {
		marginBottom: 16,
	},
	timeContainer: {
		flexDirection: "column",
	},
	timeField: {
		flex: 1,
	},
	label: {
		fontSize: 15,
		marginBottom: 8,
		color: "#555",
		fontWeight: "500",
	},
	input: {
		height: 50,
		borderColor: "#e0e0e0",
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 15,
		fontSize: 16,
		backgroundColor: "white",
		color: "#333",
	},
	dateButton: {
		backgroundColor: "white",
		padding: 15,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#e0e0e0",
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	dateButtonText: {
		fontSize: 16,
		color: "#333",
	},
	checkboxWrapper: {
		marginBottom: 16,
	},
	checkboxContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	checkbox: {
		marginRight: 8,
	},
	checkboxLabel: {
		fontSize: 15,
		color: "#333",
		fontWeight: "500",
	},
	dropdown: {
		borderColor: "#e0e0e0",
		borderWidth: 1,
		borderRadius: 8,
		backgroundColor: "white",
		minHeight: 50,
	},
	dropdownList: {
		borderColor: "#e0e0e0",
		borderWidth: 1,
		borderRadius: 8,
		backgroundColor: "white",
		marginTop: 1,
		position: "relative",
		top: 0,
	},
	dropdownItem: {
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
		minHeight: 40,
		justifyContent: "center",
	},
	notesInput: {
		minHeight: 100,
		borderColor: "#e0e0e0",
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 15,
		paddingTop: 12,
		paddingBottom: 12,
		fontSize: 16,
		backgroundColor: "white",
		color: "#333",
		textAlignVertical: "top",
	},
	attachmentsContainer: {
		marginTop: 8,
	},
	actionButtonsContainer: {
		marginTop: 8,
		marginBottom: 24,
	},
	submitButton: {
		backgroundColor: "#3d7eea",
		padding: 15,
		borderRadius: 8,
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "center",
		marginBottom: 12,
	},
	submitButtonText: {
		color: "#fff",
		fontSize: 17,
		fontWeight: "600",
		marginLeft: 8,
	},
	deleteButton: {
		backgroundColor: "#e74c3c",
		padding: 15,
		borderRadius: 8,
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "center",
	},
	helperText: {
		fontSize: 14,
		color: "#666",
		marginBottom: 12,
	},
	emptyPackagesContainer: {
		padding: 20,
		backgroundColor: "#f9f9f9",
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "#eee",
		borderStyle: "dashed",
	},
	emptyPackagesText: {
		color: "#999",
		fontSize: 16,
	},
	packagesContainer: {
		marginTop: 8,
	},
	packageItem: {
		backgroundColor: "#f9f9f9",
		borderRadius: 8,
		marginBottom: 12,
		borderWidth: 1,
		borderColor: "#eee",
		overflow: "hidden",
	},
	packageItemSelected: {
		backgroundColor: "#eaf4ff",
		borderColor: "#3d7eea",
	},
	packageItemContent: {
		padding: 12,
	},
	packageItemHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 8,
	},
	packageItemTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		flex: 1,
	},
	packageItemDescription: {
		fontSize: 14,
		color: "#666",
		marginBottom: 8,
	},
	packageItemStats: {
		fontSize: 14,
		color: "#888",
	},
	selectedPackagesContainer: {
		marginTop: 16,
		borderTopWidth: 1,
		borderTopColor: "#eee",
		paddingTop: 16,
	},
	selectedPackagesTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		marginBottom: 12,
	},
	removePackageButton: {
		padding: 4,
	},
	emptyLabelsContainer: {
		padding: 15,
		backgroundColor: "#f9f9f9",
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: "#eee",
		borderStyle: "dashed",
		marginVertical: 8,
	},
	emptyLabelsText: {
		color: "#999",
		fontSize: 16,
	},
	labelSelectorContainer: {
		marginTop: 8,
		marginBottom: 8,
	},
	labelsGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
	},
	labelOption: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 16,
		marginRight: 8,
		marginBottom: 8,
		backgroundColor: "#f5f5f5",
		borderWidth: 1,
		borderColor: "#e0e0e0",
		minHeight: 36,
	},
	labelOptionSelected: {
		backgroundColor: "#eaf4ff",
		borderColor: "#3d7eea",
	},
	labelColor: {
		width: 18,
		height: 18,
		borderRadius: 9,
		marginRight: 8,
	},
	labelColorNone: {
		width: 18,
		height: 18,
		borderRadius: 9,
		marginRight: 8,
		backgroundColor: "#f0f0f0",
		alignItems: "center",
		justifyContent: "center",
	},
	labelOptionText: {
		fontSize: 14,
		color: "#333",
	},
	selectedLabelContainer: {
		marginTop: 16,
		paddingTop: 8,
	},
	selectedLabel: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		alignSelf: "flex-start",
		marginTop: 4,
	},
	selectedLabelText: {
		color: "white",
		fontSize: 14,
		fontWeight: "500",
		textShadowColor: "rgba(0, 0, 0, 0.3)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},
});

export default EventSubmit;
