import React, {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import messaging from "@react-native-firebase/messaging";
import { toast } from "../components/ui";
import { addPushToken, setActiveCompany } from "../services/userService";
import {
	pendingNavigation,
	RootStackParamList,
} from "../navigation/navigationRef";
import { useUser } from "./UserContext";

/*
 * Push notifications.
 *
 * The payload contract is UNCHANGED from v1, deliberately: the senders live in
 * a separate repo (AH_Functions) and are updated for v2 collection paths
 * separately. Changing the `data.type` vocabulary here as well would couple two
 * deployments that already have to be coordinated.
 *
 * v1 defect fixed: the onTokenRefresh subscription's return value was discarded
 * (NotificationContext.tsx:171), leaking a listener on every (userId, loggedIn)
 * change.
 */

type NotificationContextType = {
	lastNotification: Record<string, unknown> | null;
	handleNotificationNavigation: (data: Record<string, string>) => void;
};

type RouteName = keyof RootStackParamList;

const NotificationContext = createContext<NotificationContextType>({
	lastNotification: null,
	handleNotificationNavigation: () => {},
});

/**
 * Batch notifications pack several ids into one comma-delimited string, because
 * FCM data payloads are string-only.
 */
const parseIds = (value: string): string[] =>
	value?.includes(",") ? value.split(",").map((id) => id.trim()) : [value];

/*
 * `screenName` arrives from a push payload sent by a separate repo, so it is
 * untrusted input rather than a value TypeScript can vouch for. Validated
 * against the real route table instead of cast — a sender typo should be a
 * logged no-op, not a navigation crash.
 */
const ROUTES: RouteName[] = [
	"Details",
	"TimeEntryDetails",
	"EmployeeList",
	"Availability",
];

const asRoute = (value: string | undefined): RouteName | null =>
	value && (ROUTES as string[]).includes(value) ? (value as RouteName) : null;

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
	const { userId, loggedIn } = useUser();
	const [lastNotification, setLastNotification] = useState<Record<
		string,
		unknown
	> | null>(null);

	// A push can arrive before the navigator (or auth) is ready, so it is
	// stashed and replayed once both are.
	const pendingRef = useRef<Record<string, string> | null>(null);
	const checkedInitial = useRef(false);

	const handleNotificationNavigation = useCallback(
		async (data: Record<string, string>) => {
			if (!data?.type) return;
			setLastNotification(data);

			try {
				// A notification may target a company the user is not currently
				// in, so the active company moves first.
				if (data.companyId && userId) {
					await setActiveCompany(userId, data.companyId);
				}

				const screen = asRoute(data.screenName);
				if (!screen) {
					console.warn("Unknown push screenName:", data.screenName);
					return;
				}

				switch (data.type) {
					case "user_left":
					case "new_user_joined":
						pendingNavigation.setAction(screen);
						break;

					/*
					 * A reminder that several events are still unanswered, so
					 * it opens the list rather than any one of them. `data`
					 * carries pendingCount and soonestDateKey if a richer
					 * landing is ever wanted.
					 */
					case "availability_nudge":
						pendingNavigation.setAction(screen);
						break;

					case "update":
					case "assignment":
					/*
					 * "Confirm you have seen this shift." Carries the soonest
					 * unconfirmed event, so it opens on the one with the confirm
					 * button rather than a list that does not exist — the
					 * Calendar tab badge covers however many others there are.
					 */
					case "assignment_ack_nudge":
					/*
					 * A crew member cannot make this one. Opens the event,
					 * where the warning names who and why.
					 */
					case "assignment_problem":
						if (data.eventId) {
							pendingNavigation.setAction(screen, {
								eventId: data.eventId,
							});
						}
						break;

					case "timesheet_approval":
					case "timesheet_rejection":
						if (data.timesheetId) {
							pendingNavigation.setAction(screen, {
								entryId: data.timesheetId,
								userId: data.userId,
							});
						}
						break;

					case "timesheet_approval_batch":
					case "timesheet_rejection_batch":
						if (data.timesheetId) {
							pendingNavigation.setAction(screen, {
								entryId: parseIds(data.timesheetId),
								userId: data.userId,
							});
						}
						break;

					default:
						console.warn("Unhandled notification type:", data.type);
				}
			} catch (e) {
				console.error("Notification navigation error", e);
			}
		},
		[userId],
	);

	/* Cold start: capture the launching notification before auth resolves. */
	useEffect(() => {
		if (checkedInitial.current) return;
		checkedInitial.current = true;

		messaging()
			.getInitialNotification()
			.then((message) => {
				if (message?.data)
					pendingRef.current = message.data as Record<string, string>;
			})
			.catch((e) =>
				console.error("Error reading initial notification", e),
			);
	}, []);

	/* Replay once auth is ready. */
	useEffect(() => {
		if (!loggedIn || !userId || !pendingRef.current) return;
		const data = pendingRef.current;
		pendingRef.current = null;
		handleNotificationNavigation(data);
	}, [loggedIn, userId, handleNotificationNavigation]);

	/* Background tap. */
	useEffect(() => {
		return messaging().onNotificationOpenedApp((message) => {
			if (message?.data) {
				handleNotificationNavigation(
					message.data as Record<string, string>,
				);
			}
		});
	}, [handleNotificationNavigation]);

	/* Foreground banner. */
	useEffect(() => {
		return messaging().onMessage((message) => {
			const { title, body } = message.notification ?? {};
			if (!title && !body) return;

			/*
			 * The themed banner, not `NotifierComponents.Notification` — the
			 * library's default is a white card with black text regardless of
			 * theme, which is unreadable in dark mode.
			 */
			toast.info(title ?? "", body ?? undefined, () =>
				handleNotificationNavigation(
					(message.data ?? {}) as Record<string, string>,
				),
			);
		});
	}, [handleNotificationNavigation]);

	/* Token registration and refresh. */
	useEffect(() => {
		if (!loggedIn || !userId) return;

		let cancelled = false;

		(async () => {
			try {
				const authorized = await messaging().requestPermission();
				if (!authorized) return;
				const token = await messaging().getToken();
				if (token && !cancelled) await addPushToken({ userId, token });
			} catch (e) {
				console.error("Error registering push token", e);
			}
		})();

		// v1 discarded this return value, leaking a listener each time userId or
		// loggedIn changed.
		const unsubscribe = messaging().onTokenRefresh((token) => {
			addPushToken({ userId, token });
		});

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [loggedIn, userId]);

	return (
		<NotificationContext.Provider
			value={{ lastNotification, handleNotificationNavigation }}
		>
			{children}
		</NotificationContext.Provider>
	);
};

export const useNotifications = () => useContext(NotificationContext);
