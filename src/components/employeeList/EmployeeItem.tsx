import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { FontAwesome } from "@expo/vector-icons";
import { LongPressGestureHandler, State } from "react-native-gesture-handler";
import { Role } from "../../types/enums/Role";

type EmployeeItemProps = {
	employee: any;
	index: number;
	expandedIndex: number | null;
	companyId: string;
	onPress: (index: number) => void;
	onLongPress: (employee: any) => void;
};

export const EmployeeItem = ({
	employee,
	index,
	expandedIndex,
	companyId,
	onPress,
	onLongPress,
}: EmployeeItemProps) => {
	return (
		<LongPressGestureHandler
			onHandlerStateChange={({ nativeEvent }) => {
				if (nativeEvent.state === State.ACTIVE) {
					onLongPress(employee);
				}
			}}
			minDurationMs={800}
		>
			<View>
				<TouchableOpacity onPress={() => onPress(index)}>
					<View style={styles.item}>
						<Text style={styles.name}>
							{`${employee.firstName} ${employee.lastName}`}
						</Text>
						{employee.role === Role.OWNER && (
							<FontAwesome name="star" size={24} color="red" />
						)}
						{employee.role == Role.MANAGER && (
							<FontAwesome name="star" size={24} color="gold" />
						)}
					</View>
					{expandedIndex === index && (
						<View style={styles.expandedItem}>
							<Text style={styles.expandedText}>
								Email: {employee.email}
							</Text>
						</View>
					)}
				</TouchableOpacity>
			</View>
		</LongPressGestureHandler>
	);
};

const styles = StyleSheet.create({
	item: {
		flexDirection: "row",
		justifyContent: "space-between",
		padding: 10,
		borderBottomWidth: 1,
		borderBottomColor: "#ccc",
	},
	name: {
		fontSize: 18,
	},
	expandedItem: {
		padding: 10,
		backgroundColor: "#e0e0e0",
	},
	expandedText: {
		fontSize: 16,
		color: "#333",
	},
});
