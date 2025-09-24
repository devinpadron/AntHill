export const groupEventsByDate = (events) => {
	const grouped = {};

	events.forEach((event) => {
		const dateKey = new Date(event.startDate).toISOString().split("T")[0];

		if (!grouped[dateKey]) {
			grouped[dateKey] = [];
		}

		grouped[dateKey].push(event);
	});

	// Sort events within each date group by start time
	Object.keys(grouped).forEach((date) => {
		grouped[date].sort((a, b) => {
			return a.startTime.localeCompare(b.startTime);
		});
	});

	return grouped;
};
