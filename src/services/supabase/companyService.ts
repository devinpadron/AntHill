import { supabase } from "../../lib/supabase";
import { Role } from "../../types";
import { deleteCompanyFromUser, getUser } from "./userService";

/**
 * Supabase implementation of companyService — SHADOW MODULE (see ADAPTER.md).
 *
 * Membership writes are owner-only under RLS, and a non-member can't read a
 * company by access code, so onboarding goes through the security-definer RPCs
 * (`join_company_with_code`, `create_company_with_owner`). Preferences map
 * between the camelCase app shape and the snake_case company_settings columns.
 */

type QueryDoc = { id: string; exists: boolean; data: () => any };
type QuerySnapshot = {
	docs: QueryDoc[];
	forEach: (cb: (doc: QueryDoc) => void) => void;
};
const makeQuerySnap = (docs: QueryDoc[]): QuerySnapshot => ({
	docs,
	forEach: (cb) => docs.forEach(cb),
});

// --- Access code -----------------------------------------------------------

/**
 * Resolve a company id from an access code. RLS hides companies from
 * non-members, so this calls the security-definer `lookup_company_by_access_code`
 * RPC (migration 0006). Cleaner alternative at cutover: refactor signup to
 * create the account first and let `join_company_with_code` do the validation,
 * then this anon-callable lookup can be dropped.
 */
export async function compareAccessCode(accessCode: string) {
	const { data, error } = await supabase.rpc(
		"lookup_company_by_access_code",
		{
			p_access_code: accessCode,
		},
	);
	if (error) {
		console.error("Error getting company", error);
		return null;
	}
	return (data as string | null) ?? null;
}

// --- Reads -----------------------------------------------------------------

export async function getCompanyById(company: string) {
	const { data, error } = await supabase
		.from("companies")
		.select("id, name, access_code")
		.eq("id", company)
		.maybeSingle();
	if (error || !data) {
		if (error) console.error("Error getting company", error);
		return null;
	}
	return { id: data.id, name: data.name, accessCode: data.access_code };
}

export async function getAllUsersInCompany(company: string) {
	const { data, error } = await supabase
		.from("company_members")
		.select("user_id")
		.eq("company_id", company);
	if (error) {
		console.error("Error finding users ", error);
		return null;
	}
	const employees: Record<string, any> = {};
	for (const row of data ?? []) {
		const user = await getUser(row.user_id);
		if (user) employees[row.user_id] = user;
	}
	return employees;
}

export function subscribeAllUsersInCompany(
	company: string,
	onSnap: (snapshot: QuerySnapshot) => void,
) {
	const emit = async () => {
		const { data } = await supabase
			.from("company_members")
			.select("user_id, role")
			.eq("company_id", company);
		const docs = (data ?? []).map((r) => ({
			id: r.user_id,
			exists: true,
			data: () => ({ role: r.role }),
		}));
		onSnap(makeQuerySnap(docs));
	};
	const channel = supabase
		.channel(`members:${company}`)
		.on(
			"postgres_changes",
			{
				event: "*",
				schema: "public",
				table: "company_members",
				filter: `company_id=eq.${company}`,
			},
			emit,
		)
		.subscribe();
	emit();
	return () => {
		supabase.removeChannel(channel);
	};
}

// --- Membership writes -----------------------------------------------------

/**
 * Direct membership insert (owner-only under RLS). Onboarding should use
 * `joinCompanyWithAccessCode` instead; kept for signature parity.
 */
export async function addUserToCompany(
	company: string,
	userID: string,
	role: Role = Role.USER,
) {
	const { error } = await supabase
		.from("company_members")
		.insert({ company_id: company, user_id: userID, role });
	if (error) {
		console.error("Error adding user to company", error);
		return false;
	}
	return true;
}

export async function removeUserFromCompany(company: string, userID: string) {
	try {
		const result = await deleteCompanyFromUser(userID, company);
		if (result === 1 || result !== company) return true;
		await swapUserCompanyToFirst(userID);
		return true;
	} catch (e) {
		console.error("Error removing user from company", e);
		return false;
	}
}

async function swapUserCompanyToFirst(userID: string) {
	const { data } = await supabase
		.from("company_members")
		.select("company_id")
		.eq("user_id", userID)
		.limit(1);
	await supabase
		.from("users")
		.update({ active_company_id: data?.[0]?.company_id ?? null })
		.eq("id", userID);
}

export const joinCompanyWithAccessCode = async (
	_userId: string,
	accessCode: string,
) => {
	const { data, error } = await supabase.rpc("join_company_with_code", {
		p_access_code: accessCode,
	});
	if (error) {
		console.error("Error joining company:", error);
		return false;
	}
	return (data as string) || false; // returns company id for switching
};

export async function changeUserRole(
	userId: string,
	companyId: string,
	role: Role,
): Promise<boolean> {
	const { error } = await supabase
		.from("company_members")
		.update({ role })
		.eq("company_id", companyId)
		.eq("user_id", userId);
	if (error) {
		console.error("Error changing user role:", error);
		return false;
	}
	return true;
}

// --- Company settings (camelCase app shape <-> snake_case columns) ----------

const PREF_TO_COLUMN: Record<string, string> = {
	workWeekStarts: "work_week_starts",
	allowUserEventEditing: "allow_user_event_editing",
	enableTimeSheet: "enable_timesheet",
	enableAvailability: "enable_availability",
	canViewEventLabels: "can_view_event_labels",
	availabilityReminderEnabled: "availability_reminder_enabled",
	availabilityReminderHours: "availability_reminder_hours",
	availabilityReminderMinutes: "availability_reminder_minutes",
	timeEntryForm: "time_entry_form",
	eventForm: "event_form",
};
const COLUMN_TO_PREF = Object.fromEntries(
	Object.entries(PREF_TO_COLUMN).map(([k, v]) => [v, k]),
);

export async function getCompanyPreferences(
	companyId: string,
): Promise<any | null> {
	const { data, error } = await supabase
		.from("company_settings")
		.select("*")
		.eq("company_id", companyId)
		.maybeSingle();
	if (error) {
		console.error("Error getting company preferences:", error);
		return null;
	}
	if (!data) return {};
	const prefs: Record<string, any> = {};
	for (const [col, val] of Object.entries(data)) {
		const key = COLUMN_TO_PREF[col];
		if (key) prefs[key] = val;
	}
	return prefs;
}

export async function updateCompanyPreferences(
	companyId: string,
	preferences: any,
): Promise<boolean> {
	const patch: Record<string, any> = { company_id: companyId };
	for (const [k, v] of Object.entries(preferences)) {
		const col = PREF_TO_COLUMN[k];
		if (col) patch[col] = v;
	}
	const { error } = await supabase
		.from("company_settings")
		.upsert(patch, { onConflict: "company_id" });
	if (error) {
		console.error("Error updating company preferences:", error);
		return false;
	}
	return true;
}
