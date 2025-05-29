import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export type RootStackParamList = {
	Details: { eventId: string };
	TimeEntryDetails: { timesheetId: string[] | string; userId: string };
	EmployeeList: {};
	// Add other screens as needed
};

type RouteNameType = keyof RootStackParamList;

// Store pending navigation requests
export const pendingNavigation = {
	action: null as null | {
		routeName: RouteNameType;
		params?: any;
	},

	// Set a navigation action to be executed when ready
	setAction(routeName: RouteNameType, params?: any) {
		this.action = { routeName, params };
		this.executeIfReady();
	},

	// Execute the pending navigation if navigation is ready
	executeIfReady() {
		if (this.action && navigationRef.isReady()) {
			const { routeName, params } = this.action;

			// Type-safe navigation
			navigationRef.navigate({
				name: routeName,
				params,
			} as never);

			this.action = null;
			return true;
		}
		return false;
	},
};
