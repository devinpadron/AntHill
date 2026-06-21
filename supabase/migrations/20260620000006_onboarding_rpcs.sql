-- AntHill — onboarding RPCs
-- Membership writes are owner-only under RLS, so company creation and
-- join-by-code go through these security-definer functions. Both act on the
-- calling user (auth.uid()) and validate an authenticated session.

-- Create a company, seed its settings, make the caller the owner, and switch
-- their active company. Returns the new company id.
create or replace function public.create_company_with_owner(
  p_name        text,
  p_access_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_company_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.companies (name, access_code)
  values (p_name, p_access_code)
  returning id into v_company_id;

  insert into public.company_settings (company_id) values (v_company_id);

  insert into public.company_members (company_id, user_id, role)
  values (v_company_id, v_uid, 'owner');

  update public.users set active_company_id = v_company_id where id = v_uid;

  return v_company_id;
end;
$$;

-- Join a company by access code as an employee and switch the caller's active
-- company. Idempotent if already a member. Returns the company id.
create or replace function public.join_company_with_code(
  p_access_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_company_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select id into v_company_id
  from public.companies
  where access_code = p_access_code;

  if v_company_id is null then
    raise exception 'invalid access code' using errcode = 'P0002';
  end if;

  insert into public.company_members (company_id, user_id, role)
  values (v_company_id, v_uid, 'employee')
  on conflict (company_id, user_id) do nothing;

  update public.users set active_company_id = v_company_id where id = v_uid;

  return v_company_id;
end;
$$;

-- Resolve a company id from an access code without exposing the companies row
-- (RLS hides companies from non-members). Used by the signup access-code check,
-- which runs before the account exists — hence anon-callable. (Alternatively,
-- refactor signup to create the account first and let join_company_with_code do
-- the validation; then this can be dropped.)
create or replace function public.lookup_company_by_access_code(
  p_access_code text
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.companies where access_code = p_access_code;
$$;

-- Callable only by signed-in users.
revoke execute on function public.create_company_with_owner(text, text) from public, anon;
revoke execute on function public.join_company_with_code(text)         from public, anon;
grant  execute on function public.create_company_with_owner(text, text) to authenticated;
grant  execute on function public.join_company_with_code(text)         to authenticated;

-- Access-code lookup is intentionally available pre-auth (signup).
revoke execute on function public.lookup_company_by_access_code(text) from public;
grant  execute on function public.lookup_company_by_access_code(text) to anon, authenticated;
