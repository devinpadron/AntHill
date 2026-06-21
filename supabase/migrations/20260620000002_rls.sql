-- AntHill — row-level security (DB_SCHEMA_DESIGN.md §6)
-- Base rule: you can read/write a company-scoped row only if you are a member
-- of its company. Admin-only mutations (owner/manager) layer on top. Child
-- tables without a company_id resolve scope via their parent.
--
-- Performance conventions (validated against the Supabase advisors):
--   * every policy is scoped `to authenticated` (anon never has access);
--   * `auth.uid()` is wrapped as `(select auth.uid())` so it is evaluated once
--     per statement (initplan) instead of once per row;
--   * admin write policies are split per-action so they don't stack a second
--     permissive policy on top of the members' SELECT policy;
--   * the membership helpers are STABLE so the planner can cache them.

-- ---------------------------------------------------------------------------
-- Helper functions (security definer: read company_members without recursing
-- into its own RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id
      and user_id = (select auth.uid())
      and role in ('owner', 'manager')
  );
$$;

revoke execute on function public.is_company_member(uuid) from public, anon;
revoke execute on function public.is_company_admin(uuid)  from public, anon;
grant  execute on function public.is_company_member(uuid) to authenticated;
grant  execute on function public.is_company_admin(uuid)  to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.companies                    enable row level security;
alter table public.users                        enable row level security;
alter table public.company_members              enable row level security;
alter table public.company_settings             enable row level security;
alter table public.event_labels                 enable row level security;
alter table public.packages                     enable row level security;
alter table public.checklists                   enable row level security;
alter table public.checklist_items              enable row level security;
alter table public.package_checklists           enable row level security;
alter table public.events                        enable row level security;
alter table public.event_workers                enable row level security;
alter table public.event_packages               enable row level security;
alter table public.event_checklists             enable row level security;
alter table public.event_checklist_item_states  enable row level security;
alter table public.time_entries                  enable row level security;
alter table public.time_entry_edits             enable row level security;
alter table public.time_entry_events            enable row level security;
alter table public.attachments                   enable row level security;
alter table public.fcm_tokens                    enable row level security;
alter table public.notification_outbox          enable row level security;
alter table public.user_preferences             enable row level security;

-- ---------------------------------------------------------------------------
-- Companies — members read; admins update; any authed user can create one
-- (becomes owner via the onboarding RPC that also writes company_members).
-- ---------------------------------------------------------------------------
create policy companies_select_members on public.companies
  for select to authenticated using (is_company_member(id));
create policy companies_insert_authed on public.companies
  for insert to authenticated with check ((select auth.uid()) is not null);
create policy companies_update_admin on public.companies
  for update to authenticated using (is_company_admin(id)) with check (is_company_admin(id));

-- ---------------------------------------------------------------------------
-- Users — read self and teammates (shared company); update only self.
-- Inserts happen via the auth->profile trigger (security definer).
-- ---------------------------------------------------------------------------
create policy users_select_self_or_teammate on public.users
  for select to authenticated using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.company_members me
      join public.company_members them on me.company_id = them.company_id
      where me.user_id = (select auth.uid()) and them.user_id = users.id
    )
  );
create policy users_update_self on public.users
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Company members — members read; only owners change membership (split by
-- action so SELECT isn't double-covered).
-- ---------------------------------------------------------------------------
create policy members_select on public.company_members
  for select to authenticated using (is_company_member(company_id));
create policy members_insert_owner on public.company_members
  for insert to authenticated with check (
    exists (select 1 from public.company_members m
            where m.company_id = company_members.company_id
              and m.user_id = (select auth.uid()) and m.role = 'owner')
  );
create policy members_update_owner on public.company_members
  for update to authenticated using (
    exists (select 1 from public.company_members m
            where m.company_id = company_members.company_id
              and m.user_id = (select auth.uid()) and m.role = 'owner')
  ) with check (
    exists (select 1 from public.company_members m
            where m.company_id = company_members.company_id
              and m.user_id = (select auth.uid()) and m.role = 'owner')
  );
create policy members_delete_owner on public.company_members
  for delete to authenticated using (
    exists (select 1 from public.company_members m
            where m.company_id = company_members.company_id
              and m.user_id = (select auth.uid()) and m.role = 'owner')
  );

-- ---------------------------------------------------------------------------
-- Company-scoped config — members read; admins write (split per action).
-- ---------------------------------------------------------------------------
create policy company_settings_select on public.company_settings
  for select to authenticated using (is_company_member(company_id));
create policy company_settings_insert_admin on public.company_settings
  for insert to authenticated with check (is_company_admin(company_id));
create policy company_settings_update_admin on public.company_settings
  for update to authenticated using (is_company_admin(company_id)) with check (is_company_admin(company_id));
create policy company_settings_delete_admin on public.company_settings
  for delete to authenticated using (is_company_admin(company_id));

create policy event_labels_select on public.event_labels
  for select to authenticated using (is_company_member(company_id));
create policy event_labels_insert_admin on public.event_labels
  for insert to authenticated with check (is_company_admin(company_id));
create policy event_labels_update_admin on public.event_labels
  for update to authenticated using (is_company_admin(company_id)) with check (is_company_admin(company_id));
create policy event_labels_delete_admin on public.event_labels
  for delete to authenticated using (is_company_admin(company_id));

create policy packages_select on public.packages
  for select to authenticated using (is_company_member(company_id));
create policy packages_insert_admin on public.packages
  for insert to authenticated with check (is_company_admin(company_id));
create policy packages_update_admin on public.packages
  for update to authenticated using (is_company_admin(company_id)) with check (is_company_admin(company_id));
create policy packages_delete_admin on public.packages
  for delete to authenticated using (is_company_admin(company_id));

create policy checklists_select on public.checklists
  for select to authenticated using (is_company_member(company_id));
create policy checklists_insert_admin on public.checklists
  for insert to authenticated with check (is_company_admin(company_id));
create policy checklists_update_admin on public.checklists
  for update to authenticated using (is_company_admin(company_id)) with check (is_company_admin(company_id));
create policy checklists_delete_admin on public.checklists
  for delete to authenticated using (is_company_admin(company_id));

-- Child tables resolve company scope through their parent.
create policy checklist_items_select on public.checklist_items
  for select to authenticated using (
    exists (select 1 from public.checklists c
            where c.id = checklist_items.checklist_id and is_company_member(c.company_id))
  );
create policy checklist_items_insert_admin on public.checklist_items
  for insert to authenticated with check (
    exists (select 1 from public.checklists c
            where c.id = checklist_items.checklist_id and is_company_admin(c.company_id))
  );
create policy checklist_items_update_admin on public.checklist_items
  for update to authenticated using (
    exists (select 1 from public.checklists c
            where c.id = checklist_items.checklist_id and is_company_admin(c.company_id))
  ) with check (
    exists (select 1 from public.checklists c
            where c.id = checklist_items.checklist_id and is_company_admin(c.company_id))
  );
create policy checklist_items_delete_admin on public.checklist_items
  for delete to authenticated using (
    exists (select 1 from public.checklists c
            where c.id = checklist_items.checklist_id and is_company_admin(c.company_id))
  );

create policy package_checklists_select on public.package_checklists
  for select to authenticated using (
    exists (select 1 from public.packages p
            where p.id = package_checklists.package_id and is_company_member(p.company_id))
  );
create policy package_checklists_insert_admin on public.package_checklists
  for insert to authenticated with check (
    exists (select 1 from public.packages p
            where p.id = package_checklists.package_id and is_company_admin(p.company_id))
  );
create policy package_checklists_delete_admin on public.package_checklists
  for delete to authenticated using (
    exists (select 1 from public.packages p
            where p.id = package_checklists.package_id and is_company_admin(p.company_id))
  );

-- ---------------------------------------------------------------------------
-- Events — members read; admins write.
-- ---------------------------------------------------------------------------
create policy events_select_members on public.events
  for select to authenticated using (is_company_member(company_id));
create policy events_insert_admin on public.events
  for insert to authenticated with check (is_company_admin(company_id));
create policy events_update_admin on public.events
  for update to authenticated using (is_company_admin(company_id)) with check (is_company_admin(company_id));
create policy events_delete_admin on public.events
  for delete to authenticated using (is_company_admin(company_id));

-- Event workers — members read; admins assign/remove; a worker may update
-- their own status row.
create policy event_workers_select on public.event_workers
  for select to authenticated using (
    exists (select 1 from public.events e
            where e.id = event_workers.event_id and is_company_member(e.company_id))
  );
create policy event_workers_insert_admin on public.event_workers
  for insert to authenticated with check (
    exists (select 1 from public.events e
            where e.id = event_workers.event_id and is_company_admin(e.company_id))
  );
create policy event_workers_update_self_or_admin on public.event_workers
  for update to authenticated using (
    user_id = (select auth.uid())
    or exists (select 1 from public.events e
               where e.id = event_workers.event_id and is_company_admin(e.company_id))
  ) with check (
    user_id = (select auth.uid())
    or exists (select 1 from public.events e
               where e.id = event_workers.event_id and is_company_admin(e.company_id))
  );
create policy event_workers_delete_admin on public.event_workers
  for delete to authenticated using (
    exists (select 1 from public.events e
            where e.id = event_workers.event_id and is_company_admin(e.company_id))
  );

create policy event_packages_select on public.event_packages
  for select to authenticated using (
    exists (select 1 from public.events e
            where e.id = event_packages.event_id and is_company_member(e.company_id))
  );
create policy event_packages_insert_admin on public.event_packages
  for insert to authenticated with check (
    exists (select 1 from public.events e
            where e.id = event_packages.event_id and is_company_admin(e.company_id))
  );
create policy event_packages_update_admin on public.event_packages
  for update to authenticated using (
    exists (select 1 from public.events e
            where e.id = event_packages.event_id and is_company_admin(e.company_id))
  ) with check (
    exists (select 1 from public.events e
            where e.id = event_packages.event_id and is_company_admin(e.company_id))
  );
create policy event_packages_delete_admin on public.event_packages
  for delete to authenticated using (
    exists (select 1 from public.events e
            where e.id = event_packages.event_id and is_company_admin(e.company_id))
  );

create policy event_checklists_select on public.event_checklists
  for select to authenticated using (
    exists (select 1 from public.events e
            where e.id = event_checklists.event_id and is_company_member(e.company_id))
  );
create policy event_checklists_insert_admin on public.event_checklists
  for insert to authenticated with check (
    exists (select 1 from public.events e
            where e.id = event_checklists.event_id and is_company_admin(e.company_id))
  );
create policy event_checklists_delete_admin on public.event_checklists
  for delete to authenticated using (
    exists (select 1 from public.events e
            where e.id = event_checklists.event_id and is_company_admin(e.company_id))
  );

-- Checklist item state — any member may complete items (single policy, all actions).
create policy event_checklist_states_member on public.event_checklist_item_states
  for all to authenticated using (
    exists (select 1 from public.events e
            where e.id = event_checklist_item_states.event_id and is_company_member(e.company_id))
  ) with check (
    exists (select 1 from public.events e
            where e.id = event_checklist_item_states.event_id and is_company_member(e.company_id))
  );

-- ---------------------------------------------------------------------------
-- Time entries — employees read/write their own; admins read/write any.
-- ---------------------------------------------------------------------------
create policy time_entries_select_own_or_admin on public.time_entries
  for select to authenticated using (
    is_company_admin(company_id)
    or (is_company_member(company_id) and user_id = (select auth.uid()))
  );
create policy time_entries_insert_self on public.time_entries
  for insert to authenticated with check (
    is_company_member(company_id) and user_id = (select auth.uid())
  );
create policy time_entries_update_self_or_admin on public.time_entries
  for update to authenticated using (
    is_company_admin(company_id)
    or (user_id = (select auth.uid()) and status in ('active', 'paused', 'completed'))
  ) with check (
    is_company_admin(company_id)
    or (user_id = (select auth.uid()) and status in ('active', 'paused', 'completed'))
  );

-- Time entry edits — visible with the parent entry; admins or owner write.
create policy time_entry_edits_select on public.time_entry_edits
  for select to authenticated using (
    exists (select 1 from public.time_entries t
            where t.id = time_entry_edits.time_entry_id
              and (is_company_admin(t.company_id)
                   or (is_company_member(t.company_id) and t.user_id = (select auth.uid()))))
  );
create policy time_entry_edits_insert on public.time_entry_edits
  for insert to authenticated with check (
    exists (select 1 from public.time_entries t
            where t.id = time_entry_edits.time_entry_id
              and (is_company_admin(t.company_id) or t.user_id = (select auth.uid())))
  );

-- Time entry <-> events — visible with the parent entry; admins or owner write
-- (split per action so SELECT isn't double-covered).
create policy time_entry_events_select on public.time_entry_events
  for select to authenticated using (
    exists (select 1 from public.time_entries t
            where t.id = time_entry_events.time_entry_id
              and (is_company_admin(t.company_id)
                   or (is_company_member(t.company_id) and t.user_id = (select auth.uid()))))
  );
create policy time_entry_events_insert on public.time_entry_events
  for insert to authenticated with check (
    exists (select 1 from public.time_entries t
            where t.id = time_entry_events.time_entry_id
              and (is_company_admin(t.company_id) or t.user_id = (select auth.uid())))
  );
create policy time_entry_events_delete on public.time_entry_events
  for delete to authenticated using (
    exists (select 1 from public.time_entries t
            where t.id = time_entry_events.time_entry_id
              and (is_company_admin(t.company_id) or t.user_id = (select auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- Attachments — members read; uploader writes; uploader or admin deletes.
-- ---------------------------------------------------------------------------
create policy attachments_select on public.attachments
  for select to authenticated using (is_company_member(company_id));
create policy attachments_insert_member on public.attachments
  for insert to authenticated with check (is_company_member(company_id) and uploaded_by = (select auth.uid()));
create policy attachments_delete_owner_or_admin on public.attachments
  for delete to authenticated using (uploaded_by = (select auth.uid()) or is_company_admin(company_id));

-- ---------------------------------------------------------------------------
-- FCM tokens & user preferences — strictly per-user (single policy each).
-- notification_outbox — read own; writes via service role (edge function).
-- ---------------------------------------------------------------------------
create policy fcm_tokens_own on public.fcm_tokens
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy user_preferences_own on public.user_preferences
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy notification_outbox_select_own on public.notification_outbox
  for select to authenticated using (user_id = (select auth.uid()));
