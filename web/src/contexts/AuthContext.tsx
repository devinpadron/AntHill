import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import auth from "@react-native-firebase/auth";
import {
	subscribeUser,
	subscribeUserSettings,
} from "@app/services/userService";
import { getMembershipsForUser } from "@app/services/membershipService";
import { Role } from "@app/types/enums/Role";
import type { Membership, User, UserSettings } from "@app/types";

/*
 * Who is signed in, and which companies they may administer.
 *
 * A rewrite of ../../src/contexts/UserContext.tsx rather than a reuse: that one
 * carries AsyncStorage, react-native Alert and FCM token management, none of
 * which exist here. What it does NOT change is the data — the same
 * subscribeUser / subscribeUserSettings / getMembershipsForUser services back
 * both clients.
 *
 * Two deliberate differences from the app:
 *
 *   1. The ACTIVE COMPANY IS NOT HERE. In the app it comes from
 *      users/{uid}.loggedInCompanyId; in the portal it comes from the URL, so
 *      that /{companyId}/payroll can be bookmarked and shared. CompanyGuard
 *      owns it. This context only answers "which companies may they open".
 *
 *   2. Admin memberships only. The portal is admin-only, so a plain member's
 *      companies are filtered out here and the router has nowhere to send them.
 *      This is a convenience, not a boundary — firestore.rules is the boundary,
 *      and it already enforces v2IsManager on every admin write.
 */

const AUTH_STATE_KEY = "AUTH_STATE";

export type AdminMembership = Membership;

type AuthContextValue = {
	/** Firebase uid, or "" when signed out. */
	userId: string;
	user: User | null;
	settings: UserSettings | null;
	/** Active memberships where the role is manager or owner. */
	adminMemberships: AdminMembership[];
	/** True until the first auth callback resolves — gates the whole app. */
	initializing: boolean;
	/** True while the profile/membership subscriptions are still filling in. */
	isLoading: boolean;
	loggedIn: boolean;
	/** Set when the account exists but its email is unverified. */
	needsEmailVerification: boolean;
	resendVerification: () => Promise<void>;
	signOut: () => Promise<void>;
	refreshMemberships: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
	/*
	 * Seeded from localStorage so a returning admin sees the shell immediately
	 * instead of a flash of the login page while Firebase restores the session.
	 * The app does the same with AsyncStorage under this exact key.
	 */
	const [initializing, setInitializing] = useState(
		() => localStorage.getItem(AUTH_STATE_KEY) !== "signed-out",
	);

	const [userId, setUserId] = useState("");
	const [user, setUser] = useState<User | null>(null);
	const [settings, setSettings] = useState<UserSettings | null>(null);
	const [adminMemberships, setAdminMemberships] = useState<AdminMembership[]>(
		[],
	);
	const [isLoading, setIsLoading] = useState(true);
	const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

	useEffect(() => {
		return auth().onAuthStateChanged(async (account) => {
			setInitializing(false);

			if (!account) {
				localStorage.setItem(AUTH_STATE_KEY, "signed-out");
				setUserId("");
				setUser(null);
				setSettings(null);
				setAdminMemberships([]);
				setNeedsEmailVerification(false);
				setIsLoading(false);
				return;
			}

			// The app signs unverified users straight back out. The portal
			// keeps them signed in and shows a banner instead — an admin who
			// cannot see WHY they are being bounced just tries again.
			await account.reload().catch(() => {});
			setNeedsEmailVerification(!account.emailVerified);

			localStorage.setItem(AUTH_STATE_KEY, "signed-in");
			setUserId(account.uid);
		});
	}, []);

	const loadMemberships = useCallback(async (uid: string) => {
		const all = await getMembershipsForUser(uid);
		setAdminMemberships(
			all.filter(
				(m) =>
					m.status === "active" &&
					(m.role === Role.MANAGER || m.role === Role.OWNER),
			),
		);
	}, []);

	useEffect(() => {
		if (!userId) return;

		setIsLoading(true);
		const unsubscribeUser = subscribeUser(userId, setUser);
		const unsubscribeSettings = subscribeUserSettings(userId, setSettings);

		loadMemberships(userId)
			.catch((error) => console.error("Error loading memberships", error))
			.finally(() => setIsLoading(false));

		return () => {
			unsubscribeUser();
			unsubscribeSettings();
		};
	}, [userId, loadMemberships]);

	const value = useMemo<AuthContextValue>(
		() => ({
			userId,
			user,
			settings,
			adminMemberships,
			initializing,
			isLoading,
			loggedIn: Boolean(userId),
			needsEmailVerification,
			resendVerification: async () => {
				await auth().currentUser?.sendEmailVerification();
			},
			signOut: async () => {
				// No FCM token to delete — push is a mobile concern.
				localStorage.setItem(AUTH_STATE_KEY, "signed-out");
				await auth().signOut();
			},
			refreshMemberships: async () => {
				if (userId) await loadMemberships(userId);
			},
		}),
		[
			userId,
			user,
			settings,
			adminMemberships,
			initializing,
			isLoading,
			needsEmailVerification,
			loadMemberships,
		],
	);

	return (
		<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
	);
}

export function useAuth(): AuthContextValue {
	const value = useContext(AuthContext);
	if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
	return value;
}
