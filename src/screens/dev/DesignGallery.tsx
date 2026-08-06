import React, { useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import {
	Badge,
	Button,
	Card,
	Checkbox,
	EmptyState,
	FAB,
	IconButton,
	Input,
	ListRow,
	Loading,
	Screen,
	ScreenFooter,
	ScreenHeader,
	SegmentedControl,
	Sheet,
	Skeleton,
	Text,
	toast,
	Toggle,
} from "../../components/ui";
import { Theme, useThemedStyles, useThemeMode } from "../../theme";

/**
 * Dev-only. Every primitive on one screen.
 *
 * This is how the design system gets checked in both themes without walking the
 * whole app — a component that looks right on a white settings row and wrong on
 * a dark sheet shows up here immediately. Reachable from the diagnostics
 * navigator (`DIAGNOSTICS_MODE` in `src/constants/devFlags.ts`).
 */

type Tone = "all" | "mine" | "open";

export const DesignGallery = ({ navigation }) => {
	const styles = useThemedStyles(galleryStyles);
	const { mode, setMode, scheme } = useThemeMode();

	const [segment, setSegment] = useState<Tone>("all");
	const [checked, setChecked] = useState(true);
	const [radio, setRadio] = useState(false);
	const [toggled, setToggled] = useState(true);
	const [text, setText] = useState("");
	const sheetRef = useRef<BottomSheet>(null);

	return (
		<Screen
			scroll
			keyboard="aware"
			padded
			header={
				<ScreenHeader
					title="Design gallery"
					subtitle={`${scheme} · mode: ${mode}`}
					onBack={() => navigation.goBack()}
					actions={[
						{
							icon: "color-palette-outline",
							label: "Cycle theme",
							onPress: () =>
								setMode(
									mode === "light"
										? "dark"
										: mode === "dark"
											? "system"
											: "light",
								),
						},
					]}
				/>
			}
			footer={
				<ScreenFooter safeArea>
					<Button
						title="Sticky footer action"
						onPress={() => toast.success("Saved", "Footer button")}
						fullWidth
						icon="checkmark"
					/>
				</ScreenFooter>
			}
		>
			<Card title="Typography" style={styles.card}>
				<Text variant="display">Display</Text>
				<Text variant="title">Title</Text>
				<Text variant="heading">Heading</Text>
				<Text variant="body">Body — the default for prose.</Text>
				<Text variant="bodyStrong">Body strong</Text>
				<Text variant="label" color="textSecondary">
					Label
				</Text>
				<Text variant="caption" color="textTertiary">
					Caption
				</Text>
				<Text variant="overline" color="textSecondary" uppercase>
					Overline
				</Text>
			</Card>

			<Card title="Buttons" style={styles.card}>
				<View style={styles.stack}>
					<Button title="Primary" onPress={() => {}} icon="add" />
					<Button
						title="Secondary"
						onPress={() => {}}
						variant="secondary"
					/>
					<Button
						title="Outline"
						onPress={() => {}}
						variant="outline"
					/>
					<Button title="Text" onPress={() => {}} variant="text" />
					<Button
						title="Destructive"
						onPress={() => {}}
						variant="destructive"
						icon="trash-outline"
					/>
					<Button title="Disabled" onPress={() => {}} disabled />
					<Button title="Loading" onPress={() => {}} loading />
				</View>

				<View style={styles.row}>
					<IconButton
						name="create-outline"
						onPress={() => {}}
						label="Edit"
					/>
					<IconButton
						name="share-outline"
						onPress={() => {}}
						label="Share"
						variant="soft"
					/>
					<IconButton
						name="add"
						onPress={() => {}}
						label="Add"
						variant="solid"
					/>
					<IconButton
						name="trash-outline"
						onPress={() => {}}
						label="Delete"
						color="danger"
					/>
				</View>
			</Card>

			<Card title="Selection" style={styles.card}>
				<SegmentedControl<Tone>
					segments={[
						{ value: "all", label: "All", count: 12 },
						{ value: "mine", label: "Mine", count: 3 },
						{ value: "open", label: "Open" },
					]}
					value={segment}
					onChange={setSegment}
				/>

				<View style={styles.spacer} />

				<Checkbox
					checked={checked}
					onPress={() => setChecked((v) => !v)}
					label="Checkbox"
					description="With a description line"
				/>
				<Checkbox
					checked={radio}
					onPress={() => setRadio((v) => !v)}
					label="Radio"
					radio
				/>
			</Card>

			<Card title="Inputs" style={styles.card}>
				<Input
					label="Email"
					placeholder="you@example.com"
					icon="mail-outline"
					value={text}
					onChangeText={setText}
					keyboardType="email-address"
					autoCapitalize="none"
				/>
				<View style={styles.spacer} />
				<Input
					label="Password"
					placeholder="••••••••"
					password
					value=""
					onChangeText={() => {}}
				/>
				<View style={styles.spacer} />
				<Input
					label="With an error"
					placeholder="Access code"
					value=""
					onChangeText={() => {}}
					error="That code is not recognised."
				/>
				<View style={styles.spacer} />
				<Input
					label="Notes"
					placeholder="Multiline…"
					multiline
					value=""
					onChangeText={() => {}}
				/>
			</Card>

			<Card title="Rows" flush style={styles.card}>
				<ListRow
					title="With an icon and chevron"
					icon="person-outline"
					onPress={() => {}}
				/>
				<ListRow
					title="With a value"
					subtitle="And a subtitle"
					icon="map-outline"
					value="Apple Maps"
					onPress={() => {}}
				/>
				<ListRow
					title="With a toggle"
					icon="notifications-outline"
					accessory={
						<Toggle value={toggled} onValueChange={setToggled} />
					}
					onPress={undefined}
				/>
				<ListRow
					title="Selected"
					icon="checkmark-circle-outline"
					selected
					onPress={() => {}}
				/>
				<ListRow
					title="Log out"
					icon="log-out-outline"
					destructive
					onPress={() => {}}
					separator={false}
				/>
			</Card>

			<Card title="Badges" style={styles.card}>
				<View style={styles.row}>
					<Badge label="Neutral" />
					<Badge label="Accent" tone="accent" />
					<Badge label="Approved" tone="success" icon="checkmark" />
					<Badge label="Pending" tone="warning" dot />
					<Badge label="Rejected" tone="danger" variant="solid" />
				</View>
			</Card>

			<Card title="Feedback" style={styles.card}>
				<View style={styles.stack}>
					<Button
						title="Success toast"
						onPress={() =>
							toast.success("Saved", "Your changes are live.")
						}
						variant="secondary"
					/>
					<Button
						title="Error toast"
						onPress={() =>
							toast.error("Could not save", "Check your network.")
						}
						variant="secondary"
					/>
					<Button
						title="Open sheet"
						onPress={() => sheetRef.current?.snapToIndex(0)}
						variant="secondary"
						icon="chevron-up"
					/>
				</View>
			</Card>

			<Card title="Loading" style={styles.card}>
				<Loading fill={false} size="small" />
				<View style={styles.spacer} />
				<Skeleton width="70%" />
				<View style={styles.spacer} />
				<Skeleton width="45%" height={12} />
			</Card>

			<Card title="Empty state" flush style={styles.card}>
				<EmptyState
					icon="clipboard-outline"
					title="No checklists yet"
					description="Checklists let you reuse the same set of tasks across events."
					actionLabel="Create a checklist"
					onAction={() => {}}
					compact
				/>
			</Card>

			<FAB
				icon="add"
				onPress={() => toast.info("FAB pressed")}
				label="Add"
				style={styles.fab}
			/>

			<Sheet
				ref={sheetRef}
				snapPoints={["40%"]}
				title="A bottom sheet"
				onClose={() => sheetRef.current?.close()}
			>
				<View style={styles.sheetBody}>
					<Text variant="body" color="textSecondary">
						Themed background, handle and backdrop.
					</Text>
					<View style={styles.spacer} />
					<Button
						title="Close"
						onPress={() => sheetRef.current?.close()}
						fullWidth
					/>
				</View>
			</Sheet>
		</Screen>
	);
};

const galleryStyles = (theme: Theme) =>
	StyleSheet.create({
		card: {
			marginTop: theme.spacing.lg,
		},
		stack: {
			gap: theme.spacing.sm,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			flexWrap: "wrap",
			gap: theme.spacing.sm,
			marginTop: theme.spacing.md,
		},
		spacer: {
			height: theme.spacing.md,
		},
		fab: {
			alignSelf: "flex-end",
			marginTop: theme.spacing.lg,
		},
		sheetBody: {
			padding: theme.spacing.lg,
		},
	});
