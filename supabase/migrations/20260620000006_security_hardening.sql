-- AntHill — security hardening (remediates Supabase advisor warnings)

-- 1. Pin search_path on the remaining functions (the security-definer helpers
--    already set it). Their table references are schema-qualified.
alter function public.touch_updated_at()           set search_path = public;
alter function public.validate_attachment_target()  set search_path = public;
alter function public.log_time_entry_edit()         set search_path = public;

-- 2. The auth->profile trigger function should never be API-callable; the
--    trigger fires regardless of caller EXECUTE grants. Supabase default-grants
--    EXECUTE to anon/authenticated, so revoke from those roles explicitly.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

-- 3. RLS helpers must stay executable by authenticated (policies call them),
--    but anonymous callers never legitimately need them.
revoke execute on function public.is_company_member(uuid) from public, anon;
revoke execute on function public.is_company_admin(uuid)  from public, anon;
grant  execute on function public.is_company_member(uuid) to authenticated;
grant  execute on function public.is_company_admin(uuid)  to authenticated;

-- 4. Keep extensions out of the public schema.
create schema if not exists extensions;
alter extension citext set schema extensions;
