import React, { useState, useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import Animated, {
	LinearTransition,
	useAnimatedStyle,
	withTiming,
} from "react-native-reanimated";
import { useUser } from "../../contexts/UserContext";
import { getChecklistsByIds } from "../../services/libraryService";
import {
	setItemState as writeItemState,
	subscribeChecklistState,
} from "../../services/eventChecklistService";
import {
	Badge,
	Card,
	EmptyState,
	Icon,
	Loading,
	Pressable,
	Screen,
	ScreenHeader,
	Text,
	toast,
} from "../../components/ui";
import { haptics, Theme, useTheme, useThemedStyles } from "../../theme";

/*
 * Running an event's checklists.
 *
 * Items cycle through three states rather than two: unchecked → done →
 * struck through ("not applicable"). Both of the latter count as complete.
 *
 * Motion is Reanimated's layout transition now. The previous version drove the
 * reordering with `LayoutAnimation`, which needed an Android `UIManager` opt-in
 * and a 500ms timer to suppress the animation on first load — a shared layout
 * transition just does not animate items that were never on screen.
 */

const UNCHECKED = 0;
const CHECKED = 1;
const STRIKETHROUGH = 2;

const EventChecklists = () => {
	const theme = useTheme();
	const styles = useThemedStyles(checklistStyles);
	const route = useRoute<any>();
	const navigation = useNavigation<any>();
	const { checklistIds, eventId } = route.params || {};
	const { companyId } = useUser();

	const [loading, setLoading] = useState(true);
	const [checklists, setChecklists] = useState([]);
	const [itemStates, setItemStates] = useState({});

	// Load checklists from the provided IDs
	useEffect(() => {
		const fetchChecklists = async () => {
			if (
				!checklistIds ||
				!Array.isArray(checklistIds) ||
				checklistIds.length === 0 ||
				!companyId
			) {
				setLoading(false);
				return;
			}

			try {
				// ONE batched query. v1 issued a read per checklist id.
				const byId = await getChecklistsByIds(companyId, checklistIds);
				const checklistItems = checklistIds
					.map((id) => byId[id])
					.filter(Boolean);

				const initialItemStates = {};
				checklistItems.forEach((checklist) => {
					initialItemStates[checklist.id] = {};
					(checklist.items || []).forEach((item) => {
						initialItemStates[checklist.id][item.id] = UNCHECKED;
					});
				});

				setChecklists(checklistItems);
				setItemStates(initialItemStates);
			} catch (error) {
				console.error("Error loading checklists:", error);
				toast.error(
					"Could not load checklists",
					"Pull back and try opening them again.",
				);
			} finally {
				setLoading(false);
			}
		};

		fetchChecklists();
	}, [checklistIds, companyId, eventId]);

	useEffect(() => {
		if (!eventId || !companyId) return;

		/*
		 * ONE document per event holds every checklist's state, rather
		 * than a document per checklist. Synchronous unsubscribe —
		 * the v1 helper was `async`, so this variable held a Promise
		 * and the listener was never actually torn down.
		 */
		return subscribeChecklistState(eventId, (doc) => {
			const savedStates = doc?.state ?? {};

			setItemStates((prevStates) => {
				const newStates = { ...prevStates };

				Object.keys(savedStates).forEach((checklistId) => {
					if (newStates[checklistId]) {
						newStates[checklistId] = {
							...newStates[checklistId],
							...savedStates[checklistId],
						};
					}
				});

				return newStates;
			});
		});
	}, [checklists, companyId, eventId]);

	/*
	 * Writes ONE item, as a dotted field path.
	 *
	 * v1 sent the whole checklist map through a `.set()` without merge, so two
	 * workers ticking different items on the same event overwrote each other —
	 * whoever wrote second wiped the other's ticks.
	 */
	const saveItemState = async (checklistId, itemId, state) => {
		if (!eventId || !companyId) return;

		try {
			await writeItemState(
				companyId,
				eventId,
				checklistId,
				itemId,
				state,
			);
		} catch (error) {
			console.error("Error saving checklist state:", error);
			toast.error("Could not save that tick", "Check your connection.");
		}
	};

	const toggleItemState = (checklistId, itemId) => {
		setItemStates((prevStates) => {
			const currentState = prevStates[checklistId][itemId];
			const newState = (currentState + 1) % 3;

			// Only the item that changed is written.
			saveItemState(checklistId, itemId, newState);

			return {
				...prevStates,
				[checklistId]: {
					...prevStates[checklistId],
					[itemId]: newState,
				},
			};
		});
	};

	const progressFor = (checklist) => {
		const items = checklist.items ?? [];
		if (items.length === 0) return { done: 0, total: 0, pct: 0 };

		const done = items.filter((item) => {
			const state = itemStates[checklist.id]?.[item.id] ?? UNCHECKED;
			return state === CHECKED || state === STRIKETHROUGH;
		}).length;

		return {
			done,
			total: items.length,
			pct: Math.round((done / items.length) * 100),
		};
	};

	/* Header progress across every checklist on the event. */
	const overall = useMemo(() => {
		let done = 0;
		let total = 0;
		for (const checklist of checklists) {
			const p = progressFor(checklist);
			done += p.done;
			total += p.total;
		}
		return { done, total };
	}, [checklists, itemStates]);

	const header = (
		<ScreenHeader
			title="Checklists"
			subtitle={
				overall.total > 0
					? `${overall.done} of ${overall.total} done`
					: undefined
			}
			onBack={() => navigation.goBack()}
		/>
	);

	if (loading) {
		return (
			<Screen header={header}>
				<Loading label="Loading checklists" />
			</Screen>
		);
	}

	if (checklists.length === 0) {
		return (
			<Screen header={header}>
				<EmptyState
					icon="list-outline"
					title="No checklists here"
					description="No valid checklists were found for this event."
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded header={header}>
			{checklists.map((checklist) => {
				const { done, total, pct } = progressFor(checklist);
				const isComplete = total > 0 && done === total;

				/*
				 * Unchecked items float to the top, so what is left to do is
				 * always what you are looking at.
				 */
				const sorted = [...(checklist.items ?? [])].sort((a, b) => {
					const stateA =
						itemStates[checklist.id]?.[a.id] || UNCHECKED;
					const stateB =
						itemStates[checklist.id]?.[b.id] || UNCHECKED;
					if (stateA === UNCHECKED && stateB !== UNCHECKED) return -1;
					if (stateB === UNCHECKED && stateA !== UNCHECKED) return 1;
					return 0;
				});

				return (
					<Card key={checklist.id} flush style={styles.card}>
						<View style={styles.checklistHeader}>
							<View style={styles.titleRow}>
								<Text variant="heading" style={styles.flex}>
									{checklist.title}
								</Text>
								{isComplete ? (
									<Badge
										label="Done"
										tone="success"
										icon="checkmark"
									/>
								) : (
									<Text variant="label" color="textSecondary">
										{done}/{total}
									</Text>
								)}
							</View>

							<ProgressBar percent={pct} complete={isComplete} />
						</View>

						{sorted.length === 0 ? (
							<View style={styles.emptyItems}>
								<Text variant="caption" color="textTertiary">
									No items in this checklist.
								</Text>
							</View>
						) : (
							sorted.map((item, index) => {
								const state =
									itemStates[checklist.id]?.[item.id] ||
									UNCHECKED;

								return (
									<Animated.View
										key={item.id}
										layout={LinearTransition.duration(
											theme.motion.duration.base,
										)}
									>
										<Pressable
											onPress={() => {
												haptics.selection();
												toggleItemState(
													checklist.id,
													item.id,
												);
											}}
											haptic={null}
											scaleOnPress={false}
											accessibilityRole="checkbox"
											accessibilityState={{
												checked: state !== UNCHECKED,
											}}
											accessibilityLabel={item.text}
											accessibilityHint="Cycles between done, not applicable, and unchecked"
											style={[
												styles.item,
												index < sorted.length - 1 &&
													styles.itemDivided,
											]}
										>
											{state === UNCHECKED ? (
												<View style={styles.emptyBox} />
											) : (
												<Icon
													name="checkmark-circle"
													size="md"
													color={
														state === CHECKED
															? "success"
															: "textTertiary"
													}
												/>
											)}

											<Text
												variant="body"
												color={
													state === UNCHECKED
														? "text"
														: "textTertiary"
												}
												style={[
													styles.itemText,
													state === STRIKETHROUGH &&
														styles.struck,
												]}
											>
												{item.text}
											</Text>
										</Pressable>
									</Animated.View>
								);
							})
						)}
					</Card>
				);
			})}
		</Screen>
	);
};

/** A progress bar that eases to its new width on the UI thread. */
const ProgressBar = ({
	percent,
	complete,
}: {
	percent: number;
	complete: boolean;
}) => {
	const theme = useTheme();
	const styles = useThemedStyles(checklistStyles);

	const fillStyle = useAnimatedStyle(() => ({
		width: withTiming(`${percent}%`, {
			duration: theme.motion.duration.slow,
		}),
		backgroundColor: withTiming(
			complete ? theme.colors.success : theme.colors.accent,
		),
	}));

	return (
		<View style={styles.progressTrack}>
			<Animated.View style={[styles.progressFill, fillStyle]} />
		</View>
	);
};

export default EventChecklists;

const checklistStyles = (theme: Theme) =>
	StyleSheet.create({
		flex: {
			flex: 1,
		},
		card: {
			marginTop: theme.spacing.lg,
		},
		checklistHeader: {
			paddingHorizontal: theme.spacing.lg,
			paddingTop: theme.spacing.lg,
			paddingBottom: theme.spacing.md,
		},
		titleRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.md,
			marginBottom: theme.spacing.md,
		},
		progressTrack: {
			height: 6,
			borderRadius: theme.radius.pill,
			backgroundColor: theme.colors.surfaceSunken,
			overflow: "hidden",
		},
		progressFill: {
			height: "100%",
			borderRadius: theme.radius.pill,
		},
		item: {
			flexDirection: "row",
			alignItems: "center",
			paddingHorizontal: theme.spacing.lg,
			paddingVertical: theme.spacing.md,
			minHeight: theme.hitTarget + 4,
		},
		itemDivided: {
			borderBottomWidth: theme.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		emptyBox: {
			width: 22,
			height: 22,
			borderRadius: theme.radius.pill,
			borderWidth: 1.5,
			borderColor: theme.colors.borderStrong,
		},
		itemText: {
			flex: 1,
			marginLeft: theme.spacing.md,
		},
		struck: {
			textDecorationLine: "line-through",
		},
		emptyItems: {
			paddingHorizontal: theme.spacing.lg,
			paddingBottom: theme.spacing.lg,
		},
	});
