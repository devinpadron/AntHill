import React, {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { Alert } from "react-native";
import auth from "@react-native-firebase/auth";
import messaging from "@react-native-firebase/messaging";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	subscribeUser,
	subscribeUserSettings,
	removePushToken,
} from "../../services/v2/userService";
import { subscribeMembership } from "../../services/v2/membershipService";
import { Membership, User, UserSettings } from "../../types/v2";
import { Role } from "../../types";

/*
 * Auth and the signed-in user.
 *
 * Behaviour preserved from v1: AsyncStorage AUTH_STATE so a returning user sees
 * the app shell immediately, `initializing` (gates the splash) kept distinct
 * from `isLoading` (gates data), and unverified emails signed out with a resend
 * prompt.
 *
 * Three v1 defects fixed:
 *   - subscribeUserPrivilege was `async`, so it returned a Promise rather than
 *     an unsubscribe function. UserContext.tsx:246 was the bare expression
 *     `privSubscriber;` with no cleanup and no return, leaking a listener on
 *     every companyId change.
 *   - logout called clearNotificationToken(userId, token) against a
 *     (token, userId) signature, so the token was never removed and the write
 *     landed on a document named after the token.
 *   - subscriptions fired with an empty id on first render, which RNFirebase
 *     rejects as an invalid document path.
 */

const AUTH_STATE_KEY = "AUTH_STATE";

type UserContextType = {
	user: User | null;
	userId: string;
	companyId: string | undefined;
	membership: Membership | null;
	role: Role | "";
	isAdmin: boolean | null;
	settings: UserSettings | null;
	loggedIn: boolean;
	isLoading: boolean;
	initializing: boolean;
	logout: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
	user: null,
	userId: "",
	companyId: undefined,
	membership: null,
	role: "",
	isAdmin: null,
	settings: null,
	loggedIn: false,
	isLoading: true,
	initializing: true,
	logout: async () => {},
});

export const UserProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<User | null>(null);
	const [userId, setUserId] = useState("");
	const [companyId, setCompanyId] = useState<string | undefined>(undefined);
	const [membership, setMembership] = useState<Membership | null>(null);
	const [settings, setSettings] = useState<UserSettings | null>(null);
	const [loggedIn, setLoggedIn] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [initializing, setInitializing] = useState(true);

	// A ref, not state: showing the alert must not re-render, and the guard has
	// to be readable from inside the auth callback without going stale.
	const hasShownAlert = useRef(false);

	const storeAuthState = useCallback(async () => {
		try {
			await AsyncStorage.setItem(AUTH_STATE_KEY, "true");
		} catch (e) {
			console.error("Failed to save auth state", e);
		}
	}, []);

	const clearAuthState = useCallback(async () => {
		try {
			await AsyncStorage.removeItem(AUTH_STATE_KEY);
		} catch (e) {
			console.error("Failed to clear auth state", e);
		}
	}, []);

	/* Splash gate: a returning user sees the shell before Firebase answers. */
	useEffect(() => {
		(async () => {
			try {
				const stored = await AsyncStorage.getItem(AUTH_STATE_KEY);
				if (stored === "true") setLoggedIn(true);
			} finally {
				setInitializing(false);
			}
		})();
	}, []);

	const showVerificationAlert = useCallback(() => {
		if (hasShownAlert.current) return;
		hasShownAlert.current = true;

		const signOutQuietly = () =>
			auth()
				.signOut()
				.catch(() => {});

		Alert.alert(
			"Please verify your email",
			"Check your account email to complete verification and login.",
			[
				{
					text: "Resend Email",
					onPress: async () => {
						try {
							await auth().currentUser?.sendEmailVerification();
							Alert.alert("Success", "Verification email sent!");
						} catch (e) {
							console.error(
								"Error sending verification email",
								e,
							);
							Alert.alert("Failed to send verification email.");
						}
						signOutQuietly();
					},
				},
				{ text: "OK", onPress: signOutQuietly },
			],
		);
	}, []);

	/* Auth state. */
	useEffect(() => {
		setIsLoading(true);

		return auth().onAuthStateChanged(async (authUser) => {
			try {
				if (!authUser) {
					hasShownAlert.current = false;
					setLoggedIn(false);
					setUser(null);
					setUserId("");
					setCompanyId(undefined);
					setMembership(null);
					await clearAuthState();
					setIsLoading(false);
					return;
				}

				await authUser.reload();
				const refreshed = auth().currentUser;

				if (refreshed?.emailVerified) {
					hasShownAlert.current = false;
					setUserId(refreshed.uid);
					setLoggedIn(true);
					await storeAuthState();
					// isLoading stays true until the profile arrives.
				} else {
					setLoggedIn(false);
					showVerificationAlert();
					await clearAuthState();
					setIsLoading(false);
				}
			} catch (e) {
				console.error("Error in auth state change", e);
				setLoggedIn(false);
				await clearAuthState();
				setIsLoading(false);
			}
		});
	}, [clearAuthState, storeAuthState, showVerificationAlert]);

	/* The user profile. Guarded on userId — v1 subscribed with "". */
	useEffect(() => {
		if (!loggedIn || !userId) return;

		return subscribeUser(userId, (next) => {
			setUser(next);
			setCompanyId(next?.loggedInCompanyId ?? undefined);
			setIsLoading(false);
		});
	}, [loggedIn, userId]);

	useEffect(() => {
		if (!userId) return;
		return subscribeUserSettings(userId, setSettings);
	}, [userId]);

	/*
	 * Role in the active company.
	 *
	 * The v1 equivalent leaked a listener on every companyId change. This
	 * returns the unsubscribe directly, so React cleans it up.
	 */
	useEffect(() => {
		if (!userId || !companyId) {
			setMembership(null);
			return;
		}
		return subscribeMembership(companyId, userId, setMembership);
	}, [userId, companyId]);

	const logout = useCallback(async () => {
		try {
			const token = await messaging().getToken();
			if (token && userId) {
				// Named argument, so the v1 positional swap cannot recur.
				await removePushToken({ userId, token });
				await messaging().deleteToken();
			}
		} catch (e) {
			console.error("Error clearing push token on logout", e);
		}

		try {
			await clearAuthState();
			await auth().signOut();
		} catch (e) {
			console.error("Error signing out", e);
			throw e;
		}
	}, [userId, clearAuthState]);

	const role = (membership?.role ?? "") as Role | "";
	const isAdmin = membership
		? membership.role === Role.MANAGER || membership.role === Role.OWNER
		: null;

	return (
		<UserContext.Provider
			value={{
				user,
				userId,
				companyId,
				membership,
				role,
				isAdmin,
				settings,
				loggedIn,
				isLoading,
				initializing,
				logout,
			}}
		>
			{children}
		</UserContext.Provider>
	);
};

export const useUser = () => useContext(UserContext);
