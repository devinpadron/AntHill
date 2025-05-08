export interface TimeEntry {
	id?: string;
	userId: string;
	companyId?: string;
	clockInTime: string;
	clockOutTime?: string;
	duration?: number;
	status: "active" | "paused" | "completed" | "edited";
	eventId?: string;
	eventTitle?: string;
	notes?: string;
}
