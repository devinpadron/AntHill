import { supabase } from "../../lib/supabase";
import { User } from "../../types";

/**
 * Supabase implementation of userService — SHADOW MODULE (see ADAPTER.md).
 *
 * Maps the relational schema back to the app's denormalized `User` shape so
 * consumers are unchanged: `companies[]` and `loggedInCompany` are derived from
 * company_members / users.active_company_id. Subscriptions deliver a
 * Firestore-snapshot-shaped object `{ exists, id, data() }` so the existing
 * onSnap handlers keep working; each returns an unsubscribe function.
 */

type Snapshot = { exists: boolean; id?: string; data: () => any };
const makeSnap = (id: string | undefined, data: any): Snapshot => ({
	exists: data != null,
	id,
	data: () => data,
});

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	phone: string | null;
	active_company_id: string | null;
};

async function companyIdsFor(userId: string): Promise<string[]> {
	const { data } = await supabase
		.from("company_members")
		.select("company_id")
		.eq("user_id", userId);
	return (data ?? []).map((r) => r.company_id);
}

function mapUser(row: UserRow, companies: string[]): User {
	return {
		id: row.id,
		firstName: row.first_name,
		lastName: row.last_name,
		email: row.email,
		phone: row.phone ?? undefined,
		loggedInCompany: row.active_company_id ?? "",
		companies,
	};
}

async function fetchUser(userId: string): Promise<User | null> {
	const { data, error } = await supabase
		.from("users")
		.select("id, first_name, last_name, email, phone, active_company_id")
		.eq("id", userId)
		.maybeSingle();
	if (error || !data) return null;
	const companies = await companyIdsFor(userId);
	return mapUser(data as UserRow, companies);
}

export async function getUser(userID: string) {
	try {
		return await fetchUser(userID);
	} catch (e) {
		console.error("Error getting user", e);
	}
}

export async function getUserPrivilege(userID: string, company: string) {
	const { data } = await supabase
		.from("company_members")
		.select("role")
		.eq("company_id", company)
		.eq("user_id", userID)
		.maybeSingle();
	return data?.role ?? null;
}

export function subscribeUserPrivilege(
	userID: string,
	company: string,
	onSnap: (snapshot: Snapshot) => void,
) {
	const emit = async () => {
		const role = await getUserPrivilege(userID, company);
		onSnap(makeSnap(userID, role ? { role } : null));
	};
	const channel = supabase
		.channel(`privilege:${company}:${userID}`)
		.on(
			"postgres_changes",
			{
				event: "*",
				schema: "public",
				table: "company_members",
				filter: `user_id=eq.${userID}`,
			},
			emit,
		)
		.subscribe();
	emit();
	return () => {
		supabase.removeChannel(channel);
	};
}

export function subscribeCurrentUser(onSnap: (snapshot: Snapshot) => void) {
	let channel: ReturnType<typeof supabase.channel> | null = null;
	let cancelled = false;

	(async () => {
		const { data } = await supabase.auth.getUser();
		const uid = data.user?.id;
		if (!uid || cancelled) return;

		const emit = async () => onSnap(makeSnap(uid, await fetchUser(uid)));
		channel = supabase
			.channel(`user:${uid}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "users",
					filter: `id=eq.${uid}`,
				},
				emit,
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "company_members",
					filter: `user_id=eq.${uid}`,
				},
				emit,
			)
			.subscribe();
		emit();
	})();

	return () => {
		cancelled = true;
		if (channel) supabase.removeChannel(channel);
	};
}

/** Account deletion needs elevated privileges — see authService.deleteCurrentUser. */
export async function deleteUser(_userID: string) {
	const { error } = await supabase.rpc("delete_own_account");
	if (error) throw error;
	return true;
}

/** The profile row is created by the auth trigger; seed the editable fields. */
export async function addUser(newUser: User, userID: string) {
	const { error } = await supabase
		.from("users")
		.update({
			first_name: newUser.firstName,
			last_name: newUser.lastName,
			phone: newUser.phone ?? null,
		})
		.eq("id", userID);
	if (error) throw error;
}

const USER_FIELD_MAP: Record<string, string> = {
	firstName: "first_name",
	lastName: "last_name",
	phone: "phone",
	email: "email",
	loggedInCompany: "active_company_id",
};

export async function updateUser(userID: string, userData: any) {
	const patch: Record<string, any> = {};
	for (const [k, v] of Object.entries(userData)) {
		const col = USER_FIELD_MAP[k];
		if (col) patch[col] = v;
	}
	if (Object.keys(patch).length === 0) return true;
	const { error } = await supabase
		.from("users")
		.update(patch)
		.eq("id", userID);
	if (error) {
		console.error("Error updating user:", error);
		throw error;
	}
	return true;
}

/** Phone now lives only on the user row (no company employee mirror). */
export async function updateUserPhone(
	userID: string,
	_companyID: string,
	phone: string,
): Promise<boolean> {
	const { error } = await supabase
		.from("users")
		.update({ phone })
		.eq("id", userID);
	if (error) {
		console.error("Error updating phone number:", error);
		return false;
	}
	return true;
}

export async function swapUserCompany(userID: string, companyID: string) {
	const companies = await companyIdsFor(userID);
	let target = companyID;
	if (target === "") target = companies[0];

	if (!companies.includes(target)) {
		console.error("User does not belong to company");
		return false;
	}
	const { error } = await supabase
		.from("users")
		.update({ active_company_id: target })
		.eq("id", userID);
	if (error) throw error;
	return true;
}

/**
 * Remove a membership. Returns the previous active company, or 1 when the user
 * has no remaining companies (parity with the legacy return contract). Note:
 * the user/auth row is no longer auto-deleted when empty.
 */
export async function deleteCompanyFromUser(userID: string, companyID: string) {
	const companies = await companyIdsFor(userID);
	if (!companies.includes(companyID)) {
		console.error("User does not belong to company");
		return -1;
	}
	const { error } = await supabase
		.from("company_members")
		.delete()
		.eq("company_id", companyID)
		.eq("user_id", userID);
	if (error) throw error;

	const remaining = companies.filter((c) => c !== companyID);
	if (remaining.length === 0) return 1;

	const user = await fetchUser(userID);
	return user?.loggedInCompany ?? remaining[0];
}

export const batchGetUsers = async (
	userIds: string[],
): Promise<Record<string, any>> => {
	if (userIds.length === 0) return {};
	const { data } = await supabase
		.from("users")
		.select("id, first_name, last_name, email, phone, active_company_id")
		.in("id", userIds);
	return (data ?? []).reduce(
		(acc, row) => {
			acc[row.id] = mapUser(row as UserRow, []);
			return acc;
		},
		{} as Record<string, any>,
	);
};

export const batchGetUserPrivileges = async (
	userIds: string[],
	companyId: string,
): Promise<Record<string, string>> => {
	if (userIds.length === 0 || !companyId) return {};
	const { data } = await supabase
		.from("company_members")
		.select("user_id, role")
		.eq("company_id", companyId)
		.in("user_id", userIds);
	const byId = new Map((data ?? []).map((r) => [r.user_id, r.role]));
	return userIds.reduce(
		(acc, id) => {
			acc[id] = byId.get(id) ?? "";
			return acc;
		},
		{} as Record<string, string>,
	);
};

export const getUserPreferences = async (userID: string) => {
	const { data } = await supabase
		.from("user_preferences")
		.select("prefs")
		.eq("user_id", userID)
		.maybeSingle();
	return data?.prefs ?? null;
};

export const setUserPreferences = async (userID: string, preferences: any) => {
	// Merge into the existing prefs bag (the legacy set used { merge: true }).
	const existing = (await getUserPreferences(userID)) ?? {};
	const { error } = await supabase
		.from("user_preferences")
		.upsert(
			{ user_id: userID, prefs: { ...existing, ...preferences } },
			{ onConflict: "user_id" },
		);
	if (error) throw error;
};

export const subscribeUserPreferences = (
	userID: string,
	onSnap: (snapshot: Snapshot) => void,
) => {
	const emit = async () =>
		onSnap(makeSnap(userID, await getUserPreferences(userID)));
	const channel = supabase
		.channel(`prefs:${userID}`)
		.on(
			"postgres_changes",
			{
				event: "*",
				schema: "public",
				table: "user_preferences",
				filter: `user_id=eq.${userID}`,
			},
			emit,
		)
		.subscribe();
	emit();
	return () => {
		supabase.removeChannel(channel);
	};
};
