"use client";

import {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

type Membership = { companyId: string; role: string; companyName: string };

interface AuthState {
	session: Session | null;
	loading: boolean;
	/** The admin's active company + role (first owner/manager membership). */
	company: Membership | null;
}

const AuthContext = createContext<AuthState>({
	session: null,
	loading: true,
	company: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [company, setCompany] = useState<Membership | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		supabase.auth.getSession().then(({ data }) => {
			setSession(data.session);
			setLoading(false);
		});
		const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
			setSession(s);
		});
		return () => sub.subscription.unsubscribe();
	}, []);

	// Resolve the admin's company once signed in.
	useEffect(() => {
		if (!session) {
			setCompany(null);
			return;
		}
		(async () => {
			const { data } = await supabase
				.from("company_members")
				.select("company_id, role, companies(name)")
				.eq("user_id", session.user.id)
				.in("role", ["owner", "manager"])
				.limit(1)
				.maybeSingle();
			if (data) {
				setCompany({
					companyId: data.company_id,
					role: data.role,
					companyName: (data as any).companies?.name ?? "Company",
				});
			}
		})();
	}, [session]);

	return (
		<AuthContext.Provider value={{ session, loading, company }}>
			{children}
		</AuthContext.Provider>
	);
}

export const useAuth = () => useContext(AuthContext);
