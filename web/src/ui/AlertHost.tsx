import { useEffect, useRef, useState } from "react";
import { alertBus, type AlertRequest } from "../shim/react-native";
import { Button } from "./Button";
import { Input } from "./Input";
import { Text } from "./Text";
import { toast } from "./Toast";
import styles from "./AlertHost.module.css";

/*
 * Renders the react-native `Alert` shim as a real dialog.
 *
 * This single component is what makes several shared modules reusable VERBATIM
 * on the web — most importantly src/utils/memberActions.ts, which is the
 * owner-only promote/demote/remove gate. Re-implementing that for the portal
 * would mean maintaining a permission check in two places.
 *
 * A desktop dialog is a better fit for these prompts than the phone original:
 * named buttons in a row, a destructive action that actually looks destructive,
 * and a text input for Alert.prompt that does not need a platform branch.
 *
 * One-button informational alerts are downgraded to toasts — the app made that
 * same move when it replaced ~70 Alert.alert calls.
 */

export function AlertHost() {
	const [queue, setQueue] = useState<AlertRequest[]>([]);
	const [value, setValue] = useState("");
	const dialogRef = useRef<HTMLDivElement>(null);
	const current = queue[0];

	useEffect(
		() =>
			alertBus.subscribe((request) => {
				const buttons = request.buttons ?? [];
				const informational =
					request.kind === "alert" &&
					buttons.length <= 1 &&
					!buttons[0]?.onPress;

				if (informational) {
					// Nothing to decide — say it and get out of the way.
					toast.info(request.title, request.message);
					buttons[0]?.onPress?.();
					return;
				}
				setQueue((q) => [...q, request]);
			}),
		[],
	);

	// Reset the prompt field whenever a new request comes to the front.
	useEffect(() => {
		setValue(current?.defaultValue ?? "");
	}, [current?.id, current?.defaultValue]);

	// Focus the dialog so Escape works and the tab ring starts inside it.
	useEffect(() => {
		if (current) dialogRef.current?.focus();
	}, [current?.id]);

	if (!current) return null;

	const buttons = current.buttons?.length
		? current.buttons
		: [{ text: "OK", style: "default" as const }];

	const dismiss = () => setQueue((q) => q.slice(1));

	const choose = (button: (typeof buttons)[number]) => {
		dismiss();
		// After dismissal, so a handler that raises another alert queues
		// behind this one rather than being wiped out by the slice above.
		button.onPress?.(current.kind === "prompt" ? value : undefined);
	};

	const cancel = buttons.find((b) => b.style === "cancel");

	return (
		<div
			className={styles.scrim}
			onMouseDown={(e) => {
				// Click-outside counts as cancel only when a cancel exists;
				// otherwise the choice is mandatory.
				if (e.target === e.currentTarget && cancel) choose(cancel);
			}}
		>
			<div
				ref={dialogRef}
				className={styles.dialog}
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={`alert-title-${current.id}`}
				tabIndex={-1}
				onKeyDown={(e) => {
					if (e.key === "Escape" && cancel) choose(cancel);
					if (e.key === "Enter" && current.kind === "prompt") {
						const confirm = buttons.find(
							(b) => b.style !== "cancel",
						);
						if (confirm) choose(confirm);
					}
				}}
			>
				<Text
					id={`alert-title-${current.id}`}
					variant="heading"
					as="h2"
				>
					{current.title}
				</Text>

				{current.message && (
					<Text variant="body" tone="secondary">
						{current.message}
					</Text>
				)}

				{current.kind === "prompt" && (
					<Input
						autoFocus
						type={current.secure ? "password" : "text"}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						autoComplete={
							current.secure ? "current-password" : "off"
						}
					/>
				)}

				<div className={styles.actions}>
					{buttons.map((button, index) => (
						<Button
							key={`${button.text}-${index}`}
							variant={
								button.style === "destructive"
									? "destructive"
									: button.style === "cancel"
										? "ghost"
										: "primary"
							}
							onClick={() => choose(button)}
						>
							{button.text ?? "OK"}
						</Button>
					))}
				</div>
			</div>
		</div>
	);
}
