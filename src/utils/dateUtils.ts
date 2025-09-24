export const formatDate = (dateString) => {
	const options = { weekday: "long", month: "long", day: "numeric" };
	return new Date(dateString).toLocaleDateString("en-US");
};

export const formatTime = (timeString) => {
	// Assuming timeString is in 24-hour format (HH:MM)
	const [hours, minutes] = timeString.split(":");
	const hour = parseInt(hours, 10);
	const ampm = hour >= 12 ? "PM" : "AM";
	const formattedHour = hour % 12 || 12;
	return `${formattedHour}:${minutes} ${ampm}`;
};
