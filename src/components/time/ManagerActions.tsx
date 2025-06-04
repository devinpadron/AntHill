import React from "react";
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

interface ManagerActionsProps {
	selectAll: boolean;
	toggleSelectAll: () => void;
	selectedCount: number;
	totalCount: number;
	isApproving: boolean;
	onApprove: () => Promise<void>;
	onReject: () => Promise<void>;
	onEmail?: () => Promise<void>;
	showEmailOption?: boolean;
}

const ManagerActions = ({
	selectAll,
	toggleSelectAll,
	selectedCount,
	totalCount,
	isApproving,
	onApprove,
	onReject,
	onEmail,
	showEmailOption = false,
}: ManagerActionsProps) => {
	const hasSelection = selectedCount > 0;

	return (
		<View style={styles.managerActionsCard}>
			<View style={styles.selectAllRow}>
				<TouchableOpacity
					style={styles.selectAllButton}
					onPress={toggleSelectAll}
				>
					<Icon
						name={
							selectAll
								? "checkbox-marked"
								: "checkbox-blank-outline"
						}
						size={24}
						color="#007AFF"
					/>
					<Text style={styles.selectAllText}>
						{selectAll ? "Deselect All" : "Select All"}
					</Text>
				</TouchableOpacity>

				<Text style={styles.selectedCountText}>
					{selectedCount} of {totalCount} selected
				</Text>
			</View>

			<View style={styles.managerButtonRow}>
				<TouchableOpacity
					style={[
						styles.managerActionButton,
						styles.approveButton,
						!hasSelection && styles.disabledButton,
					]}
					onPress={onApprove}
					disabled={!hasSelection || isApproving}
				>
					{isApproving ? (
						<ActivityIndicator size="small" color="#fff" />
					) : (
						<>
							<Icon name="check-circle" size={18} color="#fff" />
							<Text style={styles.buttonText}>Approve</Text>
						</>
					)}
				</TouchableOpacity>

				{showEmailOption && (
					<TouchableOpacity
						style={[
							styles.managerActionButton,
							styles.emailButton,
							!hasSelection && styles.disabledButton,
						]}
						onPress={onEmail}
						disabled={!hasSelection || isApproving}
					>
						<Icon name="email-outline" size={18} color="#fff" />
						<Text style={styles.buttonText}>Email</Text>
					</TouchableOpacity>
				)}

				<TouchableOpacity
					style={[
						styles.managerActionButton,
						styles.rejectButton,
						!hasSelection && styles.disabledButton,
					]}
					onPress={onReject}
					disabled={!hasSelection || isApproving}
				>
					<Icon name="close-circle" size={18} color="#fff" />
					<Text style={styles.buttonText}>Reject</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	managerActionsCard: {
		margin: 16,
		marginTop: 0,
		padding: 16,
		backgroundColor: "#fff",
		borderRadius: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	selectAllRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 16,
	},
	selectAllButton: {
		flexDirection: "row",
		alignItems: "center",
	},
	selectAllText: {
		marginLeft: 8,
		fontSize: 16,
		color: "#007AFF",
		fontWeight: "500",
	},
	selectedCountText: {
		fontSize: 14,
		color: "#666",
	},
	managerButtonRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: 10,
	},
	managerActionButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		flex: 1,
	},
	approveButton: {
		backgroundColor: "#34C759",
	},
	emailButton: {
		backgroundColor: "#007AFF",
	},
	rejectButton: {
		backgroundColor: "#FF3B30",
	},
	disabledButton: {
		opacity: 0.5,
	},
	buttonText: {
		color: "#fff",
		fontWeight: "600",
		marginLeft: 8,
	},
});

export default ManagerActions;
