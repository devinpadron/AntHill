import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card, EmptyState, LoadingPane, Text } from "../ui";
import styles from "./StatusPages.module.css";

/*
 * The pages that explain why there is nothing to show: no admin access, the
 * wrong company, a dead URL. Each says which of those it is — a portal that
 * answers every failure with an empty table teaches admins to distrust it.
 */

function Centered({ children }: { children: React.ReactNode }) {
	return (
		<div className={styles.page}>
			<Card className={styles.card}>{children}</Card>
		</div>
	);
}

/** Landing route. Sends an admin to their company, or explains why it cannot. */
export function RootRedirect() {
	const { initializing, isLoading, loggedIn, adminMemberships } = useAuth();

	if (initializing) return <LoadingPane label="Starting up" />;
	if (!loggedIn) return <Navigate to="/login" replace />;
	if (isLoading) return <LoadingPane label="Loading your companies" />;

	if (adminMemberships.length === 0)
		return <Navigate to="/no-access" replace />;
	if (adminMemberships.length === 1) {
		return (
			<Navigate
				to={`/${adminMemberships[0].companyId}/calendar`}
				replace
			/>
		);
	}
	return <Navigate to="/select-company" replace />;
}

export function SelectCompanyPage() {
	const { adminMemberships, signOut } = useAuth();

	return (
		<Centered>
			<Text variant="title" as="h1">
				Choose a company
			</Text>
			<Text variant="body" tone="secondary">
				You administer {adminMemberships.length} companies.
			</Text>
			<ul className={styles.list}>
				{adminMemberships.map((membership) => (
					<li key={membership.companyId}>
						<Link
							to={`/${membership.companyId}/calendar`}
							className={styles.option}
						>
							<Text variant="bodyStrong" as="span">
								{membership.companyId}
							</Text>
							<Text variant="caption" tone="tertiary" as="span">
								{membership.role}
							</Text>
						</Link>
					</li>
				))}
			</ul>
			<Button variant="ghost" onClick={() => void signOut()}>
				Sign out
			</Button>
		</Centered>
	);
}

/** Signed in, but a manager or owner of nothing. */
export function NoAccessPage() {
	const { user, signOut } = useAuth();

	return (
		<Centered>
			<EmptyState
				icon="lock-closed-outline"
				title="This portal is for admins"
				description={
					`${user?.email ?? "This account"} is signed in, but is not a ` +
					"manager or owner of any company. Ask an owner to promote " +
					"you in the AntHill app, then sign in again."
				}
				action={
					<Button variant="secondary" onClick={() => void signOut()}>
						Sign out
					</Button>
				}
			/>
		</Centered>
	);
}

/** A member of this company, but not an admin of it — or not a member at all. */
export function ForbiddenPage() {
	const location = useLocation();
	const reason = (location.state as { reason?: string } | null)?.reason;

	return (
		<Centered>
			<EmptyState
				icon="lock-closed-outline"
				tone="error"
				title={
					reason === "not-an-admin"
						? "You are not an admin of this company"
						: "You do not have access to this company"
				}
				description={
					reason === "not-an-admin"
						? "You are a member here, but the portal is limited to managers and owners. You can still use the AntHill app."
						: "Check the link, or switch to a company you administer."
				}
				action={
					<Link to="/">
						<Button variant="primary">Go to my companies</Button>
					</Link>
				}
			/>
		</Centered>
	);
}

export function NotFoundPage() {
	return (
		<Centered>
			<EmptyState
				icon="help-circle-outline"
				title="Page not found"
				description="That URL does not match anything in the portal."
				action={
					<Link to="/">
						<Button variant="primary">Go home</Button>
					</Link>
				}
			/>
		</Centered>
	);
}
