/*
 * Stands in for `react-native` itself.
 *
 * Six shared files under ../../src reach for a react-native primitive:
 *
 *   services/authService.ts   Alert
 *   services/exportService.ts Share, Platform
 *   utils/alertUtils.ts       Alert, Platform
 *   utils/memberActions.ts    Alert
 *   utils/mapUtils.ts         Platform, Linking
 *   utils/versionUtils.ts     Linking, Platform
 *
 * Shimming these four names is what makes all six reusable verbatim — most
 * importantly memberActions.ts, which is the owner-only promote/demote/remove
 * gate. Re-implementing that on the web would mean re-implementing a
 * permission check, and two copies of a permission check is one too many.
 *
 * Alert is deliberately NOT a window.alert/confirm. Those are modal to the
 * whole browser, cannot render three buttons, and cannot style a destructive
 * action. Instead requests go onto a bus that AlertHost (a real React
 * component, mounted once at the root) renders as a proper dialog. A desktop
 * dialog with named buttons is a better fit for these prompts than the phone
 * original, not a worse one.
 */

export type AlertButtonStyle = "default" | "cancel" | "destructive";

export type AlertButton = {
	text?: string;
	style?: AlertButtonStyle;
	onPress?: (value?: string) => void;
};

export type AlertRequest = {
	id: number;
	kind: "alert" | "prompt";
	title: string;
	message?: string;
	buttons?: AlertButton[];
	/** prompt only */
	secure?: boolean;
	defaultValue?: string;
};

type Listener = (request: AlertRequest) => void;

/* ------------------------------------------------------------- alert bus */

let nextId = 1;
const listeners = new Set<Listener>();
/*
 * Requests raised before AlertHost mounts are queued rather than dropped —
 * UserContext can fire the unverified-email prompt during the very first auth
 * callback, which may land before the tree finishes mounting.
 */
const pending: AlertRequest[] = [];

export const alertBus = {
	subscribe(listener: Listener): () => void {
		listeners.add(listener);
		while (pending.length) listener(pending.shift() as AlertRequest);
		return () => listeners.delete(listener);
	},

	push(request: Omit<AlertRequest, "id">): void {
		const full = { ...request, id: nextId++ };
		if (!listeners.size) {
			pending.push(full);
			return;
		}
		listeners.forEach((listener) => listener(full));
	},
};

/* --------------------------------------------------------------- exports */

export const Alert = {
	alert(
		title: string,
		message?: string,
		buttons?: AlertButton[],
		_options?: unknown,
	): void {
		alertBus.push({ kind: "alert", title, message, buttons });
	},

	/**
	 * iOS-only in react-native; alertUtils.ts routes Android through
	 * react-native-prompt-android. Both land here.
	 *
	 * The trailing `keyboardType` is accepted and ignored — alertUtils passes
	 * it, and a browser input has no equivalent knob worth honouring.
	 */
	prompt(
		title: string,
		message?: string,
		buttons?: AlertButton[],
		type?: string,
		defaultValue?: string,
		_keyboardType?: string,
	): void {
		alertBus.push({
			kind: "prompt",
			title,
			message,
			buttons,
			secure: type === "secure-text",
			defaultValue,
		});
	},
};

/*
 * OS is typed as the full react-native union rather than the literal "web".
 *
 * Shared code branches on `Platform.OS === "ios"` (versionUtils, exportService,
 * alertUtils). Typing this `"web" as const` narrows those comparisons to
 * `never` and tsc rejects them as unintentional — an error in OUR shim
 * masquerading as an error in the app's code. The runtime value is still "web",
 * so every such branch takes its non-native path.
 */
export const Platform: {
	OS: "ios" | "android" | "windows" | "macos" | "web";
	Version: number;
	select<T>(specifics: {
		web?: T;
		default?: T;
		ios?: T;
		android?: T;
		native?: T;
	}): T;
} = {
	OS: "web",
	Version: 0,
	select(specifics) {
		return (specifics.web ?? specifics.default) as never;
	},
};

export const Linking = {
	async openURL(url: string): Promise<void> {
		// noopener/noreferrer: the opened page must not get a handle back to
		// the portal's window, which is authenticated.
		window.open(url, "_blank", "noopener,noreferrer");
	},

	/**
	 * Always false. The only caller is versionUtils.openAppStore, probing for
	 * `itms-apps://` and `market://` — neither of which a browser can open, so
	 * it correctly falls through to the https store URL.
	 */
	async canOpenURL(_url: string): Promise<boolean> {
		return false;
	},
};

export type ShareContent = {
	url?: string;
	title?: string;
	message?: string;
};

export const Share = {
	/**
	 * exportService calls this after writing a file. On the web there is no
	 * file and no share sheet — the download IS the share — so this resolves
	 * as dismissed and web/src/lib/download.ts does the real work from the
	 * virtual filesystem instead.
	 */
	async share(
		_content: ShareContent,
		_options?: Record<string, unknown>,
	): Promise<{ action: string }> {
		return { action: "dismissedAction" };
	},
};

/* Types some shared modules import for their style objects. */
export type TextStyle = Record<string, any>;
export type ViewStyle = Record<string, any>;
export type ImageStyle = Record<string, any>;
