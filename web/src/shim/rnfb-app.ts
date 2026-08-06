import { app } from "./firebaseApp";

/*
 * Stands in for `@react-native-firebase/app`.
 *
 * src/lib/db.ts uses exactly one thing from it — `firebase.app()` — so that is
 * the entire surface. If a future service reaches for more, add it here rather
 * than changing the service.
 */
const firebase = {
	app: () => app,
	apps: [app],
};

export default firebase;
export { app };
