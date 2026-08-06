import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import styles from "./Toast.module.css";

/*
 * Mirrors src/components/ui/Toast.tsx, including its durations — 4500ms for an
 * error, 3000ms otherwise — so a message lingers exactly as long as it does in
 * the app.
 *
 * The app introduced toasts to replace ~70 Alert.alert calls. The portal starts
 * there: a dialog is for a decision, a toast is for an outcome.
 */

export type ToastTone = "success" | "error" | "warning" | "info";

type Toast = {
	id: number;
	tone: ToastTone;
	message: string;
	detail?: string;
};

const TONE: Record<ToastTone, { icon: IconName; className: string }> = {
	success: { icon: "checkmark-circle", className: styles.success },
	error: { icon: "alert-circle", className: styles.error },
	warning: { icon: "warning", className: styles.warning },
	info: { icon: "information-circle", className: styles.info },
};

type ToastApi = {
	show: (tone: ToastTone, message: string, detail?: string) => void;
	success: (message: string, detail?: string) => void;
	error: (message: string, detail?: string) => void;
	warning: (message: string, detail?: string) => void;
	info: (message: string, detail?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const dismiss = useCallback((id: number) => {
		setToasts((current) => current.filter((t) => t.id !== id));
	}, []);

	const show = useCallback(
		(tone: ToastTone, message: string, detail?: string) => {
			const id = nextId++;
			setToasts((current) => [...current, { id, tone, message, detail }]);
			setTimeout(() => dismiss(id), tone === "error" ? 4500 : 3000);
		},
		[dismiss],
	);

	const api = useMemo<ToastApi>(
		() => ({
			show,
			success: (m, d) => show("success", m, d),
			error: (m, d) => show("error", m, d),
			warning: (m, d) => show("warning", m, d),
			info: (m, d) => show("info", m, d),
		}),
		[show],
	);

	return (
		<ToastContext.Provider value={api}>
			{children}
			<div
				className={styles.host}
				role="region"
				aria-label="Notifications"
			>
				{toasts.map((toast) => (
					<div
						key={toast.id}
						className={[
							styles.toast,
							TONE[toast.tone].className,
						].join(" ")}
						role={toast.tone === "error" ? "alert" : "status"}
					>
						<Icon
							name={TONE[toast.tone].icon}
							size="sm"
							className={styles.icon}
						/>
						<div className={styles.copy}>
							<Text variant="bodyStrong">{toast.message}</Text>
							{toast.detail && (
								<Text variant="caption" tone="secondary">
									{toast.detail}
								</Text>
							)}
						</div>
						<button
							className={styles.close}
							onClick={() => dismiss(toast.id)}
							aria-label="Dismiss"
						>
							<Icon name="close" size="sm" />
						</button>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast(): ToastApi {
	const api = useContext(ToastContext);
	if (!api) throw new Error("useToast must be used inside <ToastProvider>");
	return api;
}

/**
 * Module-scope escape hatch for code that cannot use a hook — the Alert shim,
 * and any service-layer error handler. Set once by ToastBridge below.
 */
let externalToast: ToastApi | null = null;
export const toast: ToastApi = {
	show: (...args) => externalToast?.show(...args),
	success: (...args) => externalToast?.success(...args),
	error: (...args) => externalToast?.error(...args),
	warning: (...args) => externalToast?.warning(...args),
	info: (...args) => externalToast?.info(...args),
};

/** Mount once inside ToastProvider to wire the module-scope `toast` up. */
export function ToastBridge() {
	const api = useToast();
	useEffect(() => {
		externalToast = api;
		return () => {
			externalToast = null;
		};
	}, [api]);
	return null;
}
