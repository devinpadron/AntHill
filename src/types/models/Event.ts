export interface Event {
	id: string;
	title: string;
	date: string;
	startTime: string;
	endTime: string | null;
	locations: Location;
	duration: string | null;
	notes: string;
	assignedWorkers: string[];
	attachments?: FileUpload[];
}

type Location = {
	[address: string]: {
		latitude: number;
		longitude: number;
	};
};

export interface FileUpload {
	uri: string;
	name: string;
	type: string;
	url?: string;
	uploadTime?: number;
	path?: string;
	id?: string;
	duration?: number; // Duration in seconds for videos
	thumbnailUrl?: string; // URL for the thumbnail image
}
