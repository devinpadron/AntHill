import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { checkAppVersion, getCurrentAppVersion } from "../utils/versionUtils";
import { getAppConfig } from "../services/appConfigService";
import { SUPPORTED_SCHEMA_VERSIONS } from "../constants/schema";

export type AppGateStatus = "loading" | "ok" | "maintenance" | "update";

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

		let status: AppGateStatus = "ok";
		if (config.maintenance) {
			status = "maintenance";
		} else if (version.updateRequired || schemaUnsupported) {
			status = "update";
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
