import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export type RootStackParamList = {
	Details: { eventId: string };
	TimeEntryDetails: { entryId: string[] | string; userId: string };
	EmployeeList: {};
	/*
	 * The nudge for unanswered events lands here rather than on one event's
	 * Details, because it covers ALL of them at once — sending someone to the
	 * first of six would hide the other five.
	 *
	 * Only mounted when preferences.enableAvailability is on, which is also the
	 * only condition under which the nudge is ever sent.
	 */
	Availability: {};

	/*
	 * Where a geofence clock reminder lands. No params: the reminder says
	 * "you're here and your clock disagrees", and the clock control is the whole
	 * answer to that.
	 *
	 * Only mounted when preferences.enableTimeSheet is on — which is also the
	 * only condition under which the reminder can have been posted, since the
	 * geofence is registered off company preferences.
	 */
	Clock: {};
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

			try {
				navigationRef.navigate({
					name: routeName,
					params,
				} as never);

				this.action = null;
				return true;
			} catch (error) {
				console.error(`Navigation failed to ${routeName}:`, error);
				return false;
			}
		}

		// Not ready yet — App.tsx polls this, so the action stays queued.
		return false;
	},
};
