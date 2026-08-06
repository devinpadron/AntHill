import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { subscribeMembership } from "@app/services/membershipService";
import { setActiveCompany } from "@app/services/userService";
import { Role } from "@app/types/enums/Role";
import type { Membership } from "@app/types";
import { useAuth } from "../contexts/AuthContext";
import { CompanyProvider } from "../contexts/CompanyContext";
import { LoadingPane } from "../ui";
import { AppShell } from "../shell/AppShell";

/*
 * Everything under /:companyId passes through here.
 *
 * The check, in order:
 *   1. auth still resolving        -> hold
 *   2. not signed in               -> /login, remembering where they were going
 *   3. membership still loading    -> hold
 *   4. no membership / removed     -> /403
 *   5. role is not manager|owner   -> /403
 *   6. otherwise                   -> CompanyProvider + AppShell
 *
 * THIS IS A CONVENIENCE, NOT A SECURITY BOUNDARY. firestore.rules is the
 * boundary: v2IsManager(companyId) already gates every admin write server-side
 * and is deployed today. A tampered URL gets a 403 screen here and
 * permission-denied from Firestore either way — this exists so an admin who
 * mistypes a URL sees an explanation instead of a page of empty tables.
 *
 * The membership is a LIVE subscription rather than a one-shot read, so an
 * owner demoting someone mid-session revokes their portal access immediately.
 */

type GuardState =
	| { status: "loading" }
	| { status: "denied"; reason: "not-a-member" | "not-an-admin" }
	| { status: "allowed"; membership: Membership };

export function CompanyGuard() {
	const { companyId } = useParams<{ companyId: string }>();
	const { userId, loggedIn, initializing } = useAuth();
	const location = useLocation();
	const [state, setState] = useState<GuardState>({ status: "loading" });

	useEffect(() => {
		if (!companyId || !userId) return;

		setState({ status: "loading" });
		return subscribeMembership(companyId, userId, (membership) => {
			if (!membership || membership.status !== "active") {
				setState({ status: "denied", reason: "not-a-member" });
				return;
			}
			if (
				membership.role !== Role.MANAGER &&
				membership.role !== Role.OWNER
			) {
				setState({ status: "denied", reason: "not-an-admin" });
				return;
			}
			setState({ status: "allowed", membership });
		});
	}, [companyId, userId]);

	/*
	 * Mirror the URL back onto users/{uid}.loggedInCompanyId so the phone and
	 * the portal agree on which company is "current". Best-effort: failing to
	 * write it must never block the page.
	 */
	useEffect(() => {
		if (state.status === "allowed" && userId && companyId) {
			setActiveCompany(userId, companyId).catch(() => {});
		}
	}, [state.status, userId, companyId]);

	if (initializing) return <LoadingPane label="Starting up" />;

	if (!loggedIn) {
		return <Navigate to="/login" replace state={{ from: location }} />;
	}

	if (!companyId) return <Navigate to="/" replace />;

	if (state.status === "loading") {
		return <LoadingPane label="Checking access" />;
	}

	if (state.status === "denied") {
		return <Navigate to="/403" replace state={{ reason: state.reason }} />;
	}

	return (
		<CompanyProvider companyId={companyId} membership={state.membership}>
			<AppShell>
				<Outlet />
			</AppShell>
		</CompanyProvider>
	);
}
