export interface TimeEntry {
	id?: string;
	userId: string;
	companyId?: string;
	clockInTime: string;
	clockOutTime?: string;
	duration?: number; // In seconds
	status:
		| "active"
		| "paused"
		| "completed"
		| "edited"
		| "pending_approval"
		| "approved"
		| "rejected";
	pauseStartTime?: string;
	totalPausedSeconds?: number;
	connectedEvents?: Array<{
		eventId: string;
		eventTitle: string;
		startOverlap: string;
		endOverlap: string;
	}>;
	formResponses?: {
		[key: string]: string | number | boolean;
	};
	editHistory?: Array<{
		timestamp: string;
		editor: string;
		previousClockInTime: string;
		previousClockOutTime: string;
		previousDuration: number;
		previousFormResponses: {
			[key: string]: string | number | boolean;
		};
		summary: string;
		previousNotes?: string;
	}>;
	notes?: string;
	submittedAt?: string;
	submissionNotes?: string;
	approvedBy?: string;
	approvedAt?: string;
	rejectedBy?: string;
	rejectedAt?: string;
	rejectionReason?: string;
}
