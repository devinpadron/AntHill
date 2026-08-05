import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { checkAppVersion, getCurrentAppVersion } from "../utils/versionUtils";
import { getAppConfig } from "../services/appConfigService";
import { SUPPORTED_SCHEMA_VERSIONS } from "../constants/schema";

/**
 * Why the app is gated, if it is.
 *
 * `update` and `schema` are deliberately distinct. `update` is fixed by the
 * user updating; `schema` means the server is on a version this build does not
 * speak, which no user action resolves and which a trip to the App Store can
 * make worse after a rollback.
 */
export type AppGateStatus =
	"loading" | "ok" | "maintenance" | "update" | "schema";

export type AppGateState = {
	status: AppGateStatus;
	currentVersion: string;
	requiredVersion: string | null;
	message: string;
};

/**
 * Resolves whether the app is allowed to run against the current backend.
 *
 * Three signals, checked in priority order:
 *  1. `appConfig/schema.maintenance` — a deliberate write freeze
 *  2. `AppData/Data.required_version` — the forced-update floor
 *  3. `appConfig/schema.activeVersion` outside SUPPORTED_SCHEMA_VERSIONS —
 *     the backend has moved to a schema this build cannot read
 *
 * (2) and (3) both resolve the same way for the user — install the new build —
 * so they share one gate screen.
 *
 * Re-checks whenever the app returns to the foreground, so a session left open
 * across a cutover gets gated rather than writing against the wrong schema.
 */
export function useAppGate() {
	const [state, setState] = useState<AppGateState>({
		status: "loading",
		currentVersion: getCurrentAppVersion(),
		requiredVersion: null,
		message: "",
	});
	const [isChecking, setIsChecking] = useState(false);
	const appState = useRef(AppState.currentState);

	const check = useCallback(async () => {
		setIsChecking(true);

		// Neither call throws — both fail open to permissive defaults
		const [version, config] = await Promise.all([
			checkAppVersion(),
			getAppConfig(),
		]);

		const schemaUnsupported = !SUPPORTED_SCHEMA_VERSIONS.includes(
			config.activeVersion,
		);

		/*
		 * Two different reasons, kept apart.
		 *
		 * They used to collapse into one "update" state, so a build gated by
		 * the SCHEMA still rendered "You're on version 1.1.1, and version
		 * 1.0.100 is required" — which reads exactly like the version
		 * comparison is backwards. It is not; compare-versions ranks 1.1.1
		 * above 1.0.100 correctly. The screen was simply naming the wrong
		 * cause.
		 *
		 * The distinction is not cosmetic. A version gate is fixed by the user
		 * updating. A schema gate is not fixed by anything they can do: it
		 * means the server is on a version this build does not speak, which
		 * happens while a cutover is pending and again after a rollback — and
		 * in the rollback case sending them to the App Store is actively wrong,
		 * because the build they would need is older, not newer.
		 */
		let status: AppGateStatus = "ok";
		if (config.maintenance) {
			status = "maintenance";
		} else if (version.updateRequired) {
			status = "update";
		} else if (schemaUnsupported) {
			status = "schema";
		}

		setState({
			status,
			currentVersion: version.currentVersion,
			requiredVersion: version.requiredVersion,
			message: config.message,
		});
		setIsChecking(false);
	}, []);

	useEffect(() => {
		check();
	}, [check]);

	useEffect(() => {
		const subscription = AppState.addEventListener(
			"change",
			(next: AppStateStatus) => {
				const returnedToForeground =
					appState.current.match(/inactive|background/) &&
					next === "active";
				appState.current = next;

				if (returnedToForeground) {
					check();
				}
			},
		);

		return () => subscription.remove();
	}, [check]);

	return { ...state, isChecking, recheck: check };
}
