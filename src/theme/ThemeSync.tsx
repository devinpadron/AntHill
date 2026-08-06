import { useCallback, useEffect, useRef } from "react";
import { useUser } from "../contexts/UserContext";
import { updateUserSettings } from "../services/userService";
import { ThemeMode, useThemeMode } from "./ThemeContext";

/**
 * Carries the account's saved theme choice into the ThemeProvider.
 *
 * The provider sits above `UserProvider` — it has to, so the force-update gate
 * and the splash are themed too — which means it cannot read the user document
 * itself. This is the same bridge pattern `CompanyInitializer` uses to push
 * `loggedInCompanyId` into `CompanyContext`.
 *
 * Renders nothing.
 */
export const ThemeSync: React.FC = () => {
	const { settings } = useUser();
	const { setMode, hydrating } = useThemeMode();

	/*
	 * The last value seen from the account, applied or not.
	 *
	 * This is what stops the sync fighting the user. Picking a theme sets the
	 * local mode immediately, but the settings document still holds the old
	 * value until the write lands — so an effect that also depended on `mode`
	 * would fire on the tap, see the stale remote value, and put the old theme
	 * straight back. The write then arrived and flipped it again: two changes
	 * per tap, which is the flicker.
	 *
	 * Comparing against the last REMOTE value instead means a local choice is
	 * never contradicted, while a genuine change from another device — where
	 * the remote value moves to something we did not set — still applies.
	 */
	const lastRemote = useRef<ThemeMode | undefined>(undefined);

	useEffect(() => {
		/*
		 * Waiting on hydration matters: the locally cached mode arrives a tick
		 * after mount, and applying Firestore's value first would visibly flip
		 * the theme once on launch for anyone whose two copies disagree.
		 */
		if (hydrating) return;

		const saved = settings?.theme;
		if (!saved || saved === lastRemote.current) return;

		lastRemote.current = saved;
		setMode(saved);
		/*
		 * Deliberately NOT keyed on `mode` — see above. This reacts to the
		 * account changing, not to the local choice.
		 */
	}, [settings?.theme, setMode, hydrating]);

	return null;
};

/**
 * Sets the theme and persists it to the account.
 *
 * The local change applies immediately and does not wait on the write — a
 * failed sync leaves the device on the chosen theme rather than snapping back.
 */
export const useThemePreference = () => {
	const { mode, setMode, scheme } = useThemeMode();
	const { userId } = useUser();

	const selectMode = useCallback(
		(next: ThemeMode) => {
			setMode(next);

			if (!userId) return;

			updateUserSettings(userId, { theme: next }).catch((error) =>
				console.error("Error saving theme preference", error),
			);
		},
		[setMode, userId],
	);

	return { mode, scheme, selectMode };
};
