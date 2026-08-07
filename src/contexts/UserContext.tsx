import React, {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import messaging from "@react-native-firebase/messaging";
import {
	subscribeUser,
	subscribeUserSettings,
	removePushToken,
} from "../services/userService";
import { subscribeMembership } from "../services/membershipService";
import { isSignupInProgress } from "./signupInProgress";
import {
	clearAuthSession,
	graceRemainingMs,
	isWithinGrace,
	markVerified,
	readAuthSession,
} from "../lib/authSession";
import { onReconnect } from "../lib/connectivity";
import { clearAllCaches } from "../services/offline/swrCache";
import {
	isAuthoritativeRejection,
	isNetworkAuthError,
} from "../utils/authUtils";
import { Membership, User, UserSettings } from "../types";
import { Role } from "../types";

/*
 * Auth and the signed-in user.
 *
 * Behaviour preserved from v1: a persisted flag so a returning user sees the
 * app shell immediately, `initializing` (gates the splash) kept distinct from
 * `isLoading` (gates data), and unverified emails signed out with a resend
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
 *
 * A FOURTH, fixed here: this file used to log people out for being offline.
 *
 * The auth callback awaited `authUser.reload()` — a network round trip whose
 * only purpose is refreshing emailVerified — and its catch made no distinction
 * between "the server revoked this account" and "we are in a basement". Both
 * ran setLoggedIn(false) + cleared the stored flag. It was unrecoverable in
 * process: the effect mounts once, Firebase Auth itself never signed out (so no
 * further onAuthStateChanged was coming), and signing back in needs the very
 * network that just failed. Users were stranded on the login screen until they
 * force-quit, with a full Firestore cache sitting behind it.
 *
 * The callback is now three separated concerns:
 *
 *   1. SESSION PRESENCE, decided only from the cached authUser Firebase hands
 *      us. Synchronous, no network, so it cannot fail for being offline.
 *   2. VERIFICATION REFRESH, extracted below and never awaited by the callback.
 *      It signs out only when the SERVER says to, or when the offline grace
 *      window in constants/auth.ts has closed.
 *   3. RE-CHECK TRIGGERS — foreground and reconnect, so a session that could
 *      not be confirmed earlier is confirmed as soon as it can be.
 */

/** Floor between server re-checks, so foregrounding repeatedly is cheap. */
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

/**
 * How long to wait for the profile before showing the app anyway.
 *
 * isLoading only clears when subscribeUser delivers a snapshot. Offline that
 * fires from the Firestore cache — but only if the document was ever cached. On
 * a first-ever launch with no signal, or after the cache is cleared, nothing
 * ever arrives and the app sits on a loading state forever.
 */
const PROFILE_TIMEOUT_MS = 8000;

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
	const appState = useRef(AppState.currentState);
	const lastRefresh = useRef(0);

	/*
	 * Splash gate: a returning user sees the shell before Firebase answers.
	 *
	 * Gated on the grace window too. Restoring the flag for a session whose
	 * window has already closed would show the app shell and then bounce the
	 * user to the login screen a moment later — worse than going there directly.
	 */
	useEffect(() => {
		(async () => {
			try {
				const session = await readAuthSession();
				if (session.loggedIn && graceRemainingMs(session) > 0) {
					setLoggedIn(true);
				}
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

	/** Local sign-out plus a real Firebase one, so the two cannot disagree. */
	const forceSignOut = useCallback(async (reason: string) => {
		console.warn(`Signing out: ${reason}`);
		setLoggedIn(false);
		setIsLoading(false);
		await clearAuthSession();
		/*
		 * The old error path skipped this, which is precisely how app state and
		 * Firebase state desynced: the app rendered AuthStack while Firebase
		 * still held a valid session, so no further onAuthStateChanged was ever
		 * coming and the Login button was inert.
		 */
		await auth()
			.signOut()
			.catch(() => {});
	}, []);

	/*
	 * Confirm the session against the server, if the server is reachable.
	 *
	 * Never awaited by the auth callback. The whole point is that being unable
	 * to reach Firebase is not an event that should change what the user sees.
	 */
	const refreshVerification = useCallback(
		async (authUser: FirebaseAuthTypes.User) => {
			const uid = authUser.uid;

			try {
				await authUser.reload();
			} catch (e) {
				if (isNetworkAuthError(e)) {
					const session = await readAuthSession();
					if (isWithinGrace(session, uid)) {
						// The offline case. Deliberately does nothing.
						return;
					}
					await forceSignOut("offline grace expired");
					return;
				}

				if (isAuthoritativeRejection(e)) {
					await forceSignOut(
						`server rejected session (${(e as any)?.code})`,
					);
					return;
				}

				/*
				 * Unrecognised. Fail open and keep the session — the same
				 * choice appConfigService makes for the launch gate. An
				 * unexpected error is not evidence the account is gone, and
				 * locking someone out on one is the costlier mistake.
				 */
				console.error("Could not refresh auth verification", e);
				return;
			}

			const refreshed = auth().currentUser;
			if (refreshed?.uid !== uid) return; // Signed out or switched mid-flight.

			if (refreshed.emailVerified) {
				hasShownAlert.current = false;
				setLoggedIn(true);
				await markVerified(uid);
				return;
			}

			/*
			 * Stay quiet while a signup is running. It creates the account
			 * before it can validate the join code, so this fires for an
			 * account that may be about to be deleted — and the user would be
			 * told to verify an email alongside "invalid access code".
			 * useSignUp reports the outcome.
			 */
			setLoggedIn(false);
			setIsLoading(false);
			if (!isSignupInProgress()) showVerificationAlert();
			await clearAuthSession();
		},
		[forceSignOut, showVerificationAlert],
	);

	/*
	 * Auth state.
	 *
	 * Decides everything it can from the cached user Firebase hands us and
	 * kicks the server check off to one side. Firebase Auth persists its user
	 * locally, so this callback fires with a real user offline — a null here
	 * genuinely is a sign-out, not a failure to reach anything.
	 */
	useEffect(() => {
		setIsLoading(true);

		return auth().onAuthStateChanged((authUser) => {
			if (!authUser) {
				hasShownAlert.current = false;
				setLoggedIn(false);
				setUser(null);
				setUserId("");
				setCompanyId(undefined);
				setMembership(null);
				setIsLoading(false);
				void clearAuthSession();
				return;
			}

			setUserId(authUser.uid);

			if (authUser.emailVerified) {
				hasShownAlert.current = false;
				setLoggedIn(true);
				void markVerified(authUser.uid);
				// isLoading stays true until the profile arrives.
			}

			void refreshVerification(authUser);
		});
	}, [refreshVerification]);

	/*
	 * Re-check a session we could not confirm earlier.
	 *
	 * Foreground and reconnect, debounced. Deliberately NOT a timer: a phone
	 * that has been offline for weeks is not running our setTimeout, so grace
	 * is evaluated at the only three moments that exist — cold launch, return
	 * to foreground, and each failed refresh.
	 */
	useEffect(() => {
		if (!loggedIn || !userId) return;

		const recheck = () => {
			const now = Date.now();
			if (now - lastRefresh.current < REFRESH_INTERVAL_MS) return;
			lastRefresh.current = now;

			const authUser = auth().currentUser;
			if (authUser) void refreshVerification(authUser);
		};

		// The same idiom as useAppGate, so there is one shape for this.
		const subscription = AppState.addEventListener(
			"change",
			(next: AppStateStatus) => {
				const returnedToForeground =
					appState.current.match(/inactive|background/) &&
					next === "active";
				appState.current = next;
				if (returnedToForeground) recheck();
			},
		);

		const stopWatchingNetwork = onReconnect(recheck);

		return () => {
			subscription.remove();
			stopWatchingNetwork();
		};
	}, [loggedIn, userId, refreshVerification]);

	/* The user profile. Guarded on userId — v1 subscribed with "". */
	useEffect(() => {
		if (!loggedIn || !userId) return;

		/* See PROFILE_TIMEOUT_MS: never let a cold offline launch hang here. */
		const timeout = setTimeout(
			() => setIsLoading(false),
			PROFILE_TIMEOUT_MS,
		);

		const unsubscribe = subscribeUser(userId, (next) => {
			clearTimeout(timeout);
			setUser(next);
			setCompanyId(next?.loggedInCompanyId ?? undefined);
			setIsLoading(false);
		});

		return () => {
			clearTimeout(timeout);
			unsubscribe();
		};
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

		/*
		 * Drop cached company data before signing out.
		 *
		 * These phones get shared between staff, and the caches hold one
		 * worker's hours and shift history. Leaving that for whoever signs in
		 * next is a real incident, not a tidiness question.
		 */
		await clearAllCaches();

		try {
			await clearAuthSession();
			await auth().signOut();
		} catch (e) {
			console.error("Error signing out", e);
			throw e;
		}
	}, [userId]);

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
