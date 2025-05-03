import { Event } from "./Event";

export interface Company {
	accessCode: string;
	Users?: UserData[];
	Events?: Event[];
}

export interface UserData {
	role: string;
}
