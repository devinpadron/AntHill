export const formatDuration = (seconds: number): string => {
	if (!seconds) return "0h 0m";

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
};

export const calculateMultipliedValue = (
	value: any,
	multiplier: number,
): string | null => {
	if (!value || !multiplier) return null;

	const numValue = parseFloat(value);
	if (isNaN(numValue)) return null;

	const result = numValue * multiplier;
	return result % 1 !== 0 ? result.toFixed(2) : result.toString();
};

export const getStatusBadgeColor = (status: string): string => {
	switch (status) {
		case "approved":
			return "#d4edda"; // Green
		case "pending_approval":
			return "#fff3cd"; // Orange
		case "edited":
			return "#cce5ff"; // Yellow
		case "active":
			return "#d1ecf1"; // Blue
		case "paused":
			return "#fff3cd"; // Orange
		case "rejected":
			return "#f8d7da"; // Red
		default:
			return "#f8d7da"; // Grey
	}
};

export const getStatusBadgeText = (status: string): string => {
	switch (status) {
		case "approved":
			return "Approved";
		case "pending_approval":
			return "Pending Approval";
		case "edited":
			return "Edited";
		case "active":
			return "Active";
		case "paused":
			return "Paused";
		case "rejected":
			return "Rejected";
		default:
			return "Not Submitted";
	}
};
