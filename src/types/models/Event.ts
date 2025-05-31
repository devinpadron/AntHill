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
	packages: string[];
}

type Location = {
	[address: string]: {
		latitude: number;
		longitude: number;
	};
};
