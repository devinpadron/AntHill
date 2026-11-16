import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Input, SegmentedControl } from "../ui";
import { TaskAnchor } from "../../types";
import {
	OffsetDirection,
	OffsetUnit,
	offsetToParts,
	partsToOffset,
} from "../../utils/eventTaskUtils";
import { Theme, useThemedStyles } from "../../theme";

/*
 * "N hours|days before|after the event starts|ends".
 *
 * One control for both a task's due time and each reminder's first send,
 * because they are the same kind of value and a manager should only have to
 * learn the shape once.
 *
 * Hours and days only. The scheduler runs hourly, so offering minutes would
 * promise a precision nothing delivers.
 */
export function TaskOffsetEditor({
	anchor,
	offsetSeconds,
	onChange,
}: {
	anchor: TaskAnchor;
	offsetSeconds: number;
	onChange: (next: { anchor: TaskAnchor; offsetSeconds: number }) => void;
}) {
	const styles = useThemedStyles(offsetStyles);
	const parts = offsetToParts(offsetSeconds);

	/*
	 * The amount is held as text and committed on blur. Committing per
	 * keystroke would turn "12" into "1" then "12", and — worse — an emptied
	 * field into 0 before the next digit could be typed.
	 */
	const [amount, setAmount] = useState(String(parts.amount));
	useEffect(() => {
		setAmount(String(parts.amount));
	}, [parts.amount]);

	const commit = (next: Partial<typeof parts>) =>
		onChange({
			anchor,
			offsetSeconds: partsToOffset({ ...parts, ...next }),
		});

	return (
		<View style={styles.root}>
			<View style={styles.row}>
				<Input
					value={amount}
					onChangeText={setAmount}
					onBlur={() =>
						commit({
							amount: Math.max(0, parseInt(amount, 10) || 0),
						})
					}
					keyboardType="number-pad"
					accessibilityLabel="How many"
					containerStyle={styles.amount}
				/>
				<SegmentedControl<OffsetUnit>
					fullWidth
					style={styles.flex}
					segments={[
						{ value: "hours", label: "Hours" },
						{ value: "days", label: "Days" },
					]}
					value={parts.unit}
					onChange={(unit) =>
						commit({
							unit,
							amount: Math.max(0, parseInt(amount, 10) || 0),
						})
					}
				/>
			</View>

			<SegmentedControl<OffsetDirection>
				fullWidth
				segments={[
					{ value: "before", label: "Before" },
					{ value: "after", label: "After" },
				]}
				value={parts.direction}
				onChange={(direction) => commit({ direction })}
			/>

			<SegmentedControl<TaskAnchor>
				fullWidth
				segments={[
					{ value: "eventStart", label: "Event starts" },
					{ value: "eventEnd", label: "Event ends" },
				]}
				value={anchor}
				onChange={(nextAnchor) =>
					onChange({ anchor: nextAnchor, offsetSeconds })
				}
			/>
		</View>
	);
}

const offsetStyles = (theme: Theme) =>
	StyleSheet.create({
		root: {
			gap: theme.spacing.sm,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.md,
		},
		amount: {
			width: 84,
		},
		flex: {
			flex: 1,
		},
	});
