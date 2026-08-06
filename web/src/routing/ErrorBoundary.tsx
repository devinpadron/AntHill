import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Card, EmptyState, Text } from "../ui";

/*
 * Catches a render crash and shows something an admin can act on.
 *
 * The error id is the point: without one, a bug report is "the payroll page
 * broke". With one, the message can be searched against the console. The raw
 * message and stack are shown behind a disclosure rather than hidden — the
 * audience here is a small business owner and whoever they forward it to, and a
 * stack they can copy beats a stack only the console has.
 */

type State = { error: Error | null; errorId: string };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
	state: State = { error: null, errorId: "" };

	static getDerivedStateFromError(error: Error): State {
		return {
			error,
			errorId: Math.random().toString(36).slice(2, 10).toUpperCase(),
		};
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error(`[portal ${this.state.errorId}]`, error, info);
	}

	render() {
		const { error, errorId } = this.state;
		if (!error) return this.props.children;

		return (
			<div
				style={{
					minHeight: "100vh",
					display: "grid",
					placeItems: "center",
					padding: "var(--sp-xl)",
					background: "var(--c-bg)",
				}}
			>
				<Card
					style={{
						width: "min(560px, 100%)",
						padding: "var(--sp-xl)",
					}}
				>
					<EmptyState
						tone="error"
						title="Something went wrong on this page"
						description={
							"The rest of the portal is still fine — reloading usually clears it. " +
							`If it keeps happening, quote error ${errorId}.`
						}
						action={
							<Button
								variant="primary"
								onClick={() => window.location.reload()}
							>
								Reload
							</Button>
						}
					/>
					<details style={{ marginTop: "var(--sp-lg)" }}>
						<summary
							style={{
								cursor: "pointer",
								color: "var(--c-text-secondary)",
								font: "var(--t-label)",
							}}
						>
							Technical detail ({errorId})
						</summary>
						<Text
							variant="caption"
							tone="tertiary"
							mono
							as="pre"
							style={{
								marginTop: "var(--sp-sm)",
								whiteSpace: "pre-wrap",
								wordBreak: "break-word",
								maxHeight: 220,
								overflow: "auto",
							}}
						>
							{error.message}
							{"\n\n"}
							{error.stack}
						</Text>
					</details>
				</Card>
			</div>
		);
	}
}
