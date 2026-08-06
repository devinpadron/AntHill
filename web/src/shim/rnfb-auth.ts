import {
	getAuth,
	signInWithEmailAndPassword,
	signOut as mSignOut,
	onAuthStateChanged as mOnAuthStateChanged,
	sendPasswordResetEmail as mSendPasswordResetEmail,
	sendEmailVerification as mSendEmailVerification,
	reauthenticateWithCredential as mReauthenticate,
	deleteUser as mDeleteUser,
	reload as mReload,
	EmailAuthProvider,
	type User as MUser,
	type Auth,
	type AuthCredential,
} from "firebase/auth";
import { app } from "./firebaseApp";

/*
 * Stands in for `@react-native-firebase/auth`.
 *
 * RNFirebase's User is a live object with instance methods
 * (user.reauthenticateWithCredential(...), user.delete(), user.reload()); the
 * modular web SDK moved those to free functions taking the user. src/services/
 * authService.ts and the app's UserContext call the instance form, so
 * `currentUser` is decorated on the way out.
 *
 * The decoration is applied to a NEW object rather than mutating the SDK's User
 * — assigning onto the live instance would fight the SDK's own property
 * definitions and leak across token refreshes.
 */

export type ShimUser = MUser & {
	sendEmailVerification(): Promise<void>;
	reauthenticateWithCredential(credential: AuthCredential): Promise<unknown>;
	delete(): Promise<void>;
	reload(): Promise<void>;
};

function decorate(user: MUser | null): ShimUser | null {
	if (!user) return null;

	// Prototype-chained so every getter on the real User (uid, email,
	// emailVerified, …) keeps working and stays live.
	return Object.create(user, {
		sendEmailVerification: {
			value: () => mSendEmailVerification(user),
		},
		reauthenticateWithCredential: {
			value: (credential: AuthCredential) =>
				mReauthenticate(user, credential),
		},
		delete: { value: () => mDeleteUser(user) },
		reload: { value: () => mReload(user) },
	}) as ShimUser;
}

const instance = () => getAuth(app);

type AuthShim = {
	(): {
		readonly currentUser: ShimUser | null;
		signOut(): Promise<void>;
		onAuthStateChanged(
			listener: (user: ShimUser | null) => void,
		): () => void;
		sendPasswordResetEmail(email: string): Promise<void>;
		signInWithEmailAndPassword(
			email: string,
			password: string,
		): Promise<{ user: ShimUser | null }>;
		readonly app: Auth["app"];
	};
	EmailAuthProvider: typeof EmailAuthProvider;
};

const authShim = (() => ({
	get currentUser() {
		return decorate(instance().currentUser);
	},
	get app() {
		return instance().app;
	},
	signOut: () => mSignOut(instance()),
	onAuthStateChanged: (listener: (user: ShimUser | null) => void) =>
		mOnAuthStateChanged(instance(), (user) => listener(decorate(user))),
	sendPasswordResetEmail: (email: string) =>
		mSendPasswordResetEmail(instance(), email),
	signInWithEmailAndPassword: async (email: string, password: string) => {
		const credential = await signInWithEmailAndPassword(
			instance(),
			email,
			password,
		);
		return { user: decorate(credential.user) };
	},
})) as AuthShim;

// `auth.EmailAuthProvider.credential(email, password)` — used by reAuth().
authShim.EmailAuthProvider = EmailAuthProvider;

export default authShim;
export { EmailAuthProvider };
