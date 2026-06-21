-- AntHill — row-level security (DB_SCHEMA_DESIGN.md §6)
-- Base rule: you can read/write a company-scoped row only if you are a member
-- of its company. Admin-only mutations (owner/manager) layer on top.
-- Child tables without a company_id resolve scope via their parent.

-- ---------------------------------------------------------------------------
-- Helper functions (security definer: read company_members without recursing
-- into its own RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id
      and user_id = auth.uid()
      and role in ('owner', 'manager')
  );
$$;

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
-- (becomes owner via an onboarding RPC that also writes company_members).
-- ---------------------------------------------------------------------------
create policy companies_select_members on public.companies
  for select using (is_company_member(id));
create policy companies_insert_authed on public.companies
  for insert with check (auth.uid() is not null);
create policy companies_update_admin on public.companies
  for update using (is_company_admin(id)) with check (is_company_admin(id));

-- ---------------------------------------------------------------------------
-- Users — read self and teammates (shared company); update only self.
-- Inserts happen via the auth->profile trigger (security definer).
-- ---------------------------------------------------------------------------
create policy users_select_self_or_teammate on public.users
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.company_members me
      join public.company_members them
        on me.company_id = them.company_id
      where me.user_id = auth.uid() and them.user_id = users.id
    )
  );
create policy users_update_self on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Company members — members read; only owners change membership.
-- (Join-by-access-code is a security-definer RPC, not a direct insert.)
-- ---------------------------------------------------------------------------
create policy members_select on public.company_members
  for select using (is_company_member(company_id));
create policy members_write_owner on public.company_members
  for all using (
    exists (
      select 1 from public.company_members m
      where m.company_id = company_members.company_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- Company settings — members read; admins write.
-- ---------------------------------------------------------------------------
create policy company_settings_select on public.company_settings
  for select using (is_company_member(company_id));
create policy company_settings_write_admin on public.company_settings
  for all using (is_company_admin(company_id)) with check (is_company_admin(company_id));

-- ---------------------------------------------------------------------------
-- Company-scoped config (labels / packages / checklists) — members read,
-- admins write.
-- ---------------------------------------------------------------------------
create policy event_labels_select on public.event_labels
  for select using (is_company_member(company_id));
create policy event_labels_write_admin on public.event_labels
  for all using (is_company_admin(company_id)) with check (is_company_admin(company_id));

create policy packages_select on public.packages
  for select using (is_company_member(company_id));
create policy packages_write_admin on public.packages
  for all using (is_company_admin(company_id)) with check (is_company_admin(company_id));

create policy checklists_select on public.checklists
  for select using (is_company_member(company_id));
create policy checklists_write_admin on public.checklists
  for all using (is_company_admin(company_id)) with check (is_company_admin(company_id));

-- Child tables resolve company scope through their parent.
create policy checklist_items_select on public.checklist_items
  for select using (
    exists (select 1 from public.checklists c
            where c.id = checklist_items.checklist_id and is_company_member(c.company_id))
  );
create policy checklist_items_write_admin on public.checklist_items
  for all using (
    exists (select 1 from public.checklists c
            where c.id = checklist_items.checklist_id and is_company_admin(c.company_id))
  ) with check (
    exists (select 1 from public.checklists c
            where c.id = checklist_items.checklist_id and is_company_admin(c.company_id))
  );

create policy package_checklists_select on public.package_checklists
  for select using (
    exists (select 1 from public.packages p
            where p.id = package_checklists.package_id and is_company_member(p.company_id))
  );
create policy package_checklists_write_admin on public.package_checklists
  for all using (
    exists (select 1 from public.packages p
            where p.id = package_checklists.package_id and is_company_admin(p.company_id))
  ) with check (
    exists (select 1 from public.packages p
            where p.id = package_checklists.package_id and is_company_admin(p.company_id))
  );

-- ---------------------------------------------------------------------------
-- Events — members read; admins write.
-- ---------------------------------------------------------------------------
create policy events_select_members on public.events
  for select using (is_company_member(company_id));
create policy events_insert_admin on public.events
  for insert with check (is_company_admin(company_id));
create policy events_update_admin on public.events
  for update using (is_company_admin(company_id)) with check (is_company_admin(company_id));
create policy events_delete_admin on public.events
  for delete using (is_company_admin(company_id));

-- Event workers — members read; a worker may update their own status;
-- admins assign/remove and edit any.
create policy event_workers_select on public.event_workers
  for select using (
    exists (select 1 from public.events e
            where e.id = event_workers.event_id and is_company_member(e.company_id))
  );
create policy event_workers_update_self_or_admin on public.event_workers
  for update using (
    user_id = auth.uid()
    or exists (select 1 from public.events e
               where e.id = event_workers.event_id and is_company_admin(e.company_id))
  ) with check (
    user_id = auth.uid()
    or exists (select 1 from public.events e
               where e.id = event_workers.event_id and is_company_admin(e.company_id))
  );
create policy event_workers_write_admin on public.event_workers
  for all using (
    exists (select 1 from public.events e
            where e.id = event_workers.event_id and is_company_admin(e.company_id))
  ) with check (
    exists (select 1 from public.events e
            where e.id = event_workers.event_id and is_company_admin(e.company_id))
  );

create policy event_packages_select on public.event_packages
  for select using (
    exists (select 1 from public.events e
            where e.id = event_packages.event_id and is_company_member(e.company_id))
  );
create policy event_packages_write_admin on public.event_packages
  for all using (
    exists (select 1 from public.events e
            where e.id = event_packages.event_id and is_company_admin(e.company_id))
  ) with check (
    exists (select 1 from public.events e
            where e.id = event_packages.event_id and is_company_admin(e.company_id))
  );

create policy event_checklists_select on public.event_checklists
  for select using (
    exists (select 1 from public.events e
            where e.id = event_checklists.event_id and is_company_member(e.company_id))
  );
create policy event_checklists_write_admin on public.event_checklists
  for all using (
    exists (select 1 from public.events e
            where e.id = event_checklists.event_id and is_company_admin(e.company_id))
  ) with check (
    exists (select 1 from public.events e
            where e.id = event_checklists.event_id and is_company_admin(e.company_id))
  );

-- Checklist item state — any member may check items (workers complete tasks).
create policy event_checklist_states_member on public.event_checklist_item_states
  for all using (
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
  for select using (
    is_company_admin(company_id)
    or (is_company_member(company_id) and user_id = auth.uid())
  );
create policy time_entries_insert_self on public.time_entries
  for insert with check (
    is_company_member(company_id) and user_id = auth.uid()
  );
create policy time_entries_update_self_or_admin on public.time_entries
  for update using (
    is_company_admin(company_id)
    or (user_id = auth.uid() and status in ('active', 'paused', 'completed'))
  ) with check (
    is_company_admin(company_id)
    or (user_id = auth.uid() and status in ('active', 'paused', 'completed'))
  );

-- Time entry edits — visible with the parent entry; admins or the owner write.
create policy time_entry_edits_select on public.time_entry_edits
  for select using (
    exists (select 1 from public.time_entries t
            where t.id = time_entry_edits.time_entry_id
              and (is_company_admin(t.company_id)
                   or (is_company_member(t.company_id) and t.user_id = auth.uid())))
  );
create policy time_entry_edits_insert on public.time_entry_edits
  for insert with check (
    exists (select 1 from public.time_entries t
            where t.id = time_entry_edits.time_entry_id
              and (is_company_admin(t.company_id) or t.user_id = auth.uid()))
  );

-- Time entry ↔ events — visible/writable with the parent entry.
create policy time_entry_events_select on public.time_entry_events
  for select using (
    exists (select 1 from public.time_entries t
            where t.id = time_entry_events.time_entry_id
              and (is_company_admin(t.company_id)
                   or (is_company_member(t.company_id) and t.user_id = auth.uid())))
  );
create policy time_entry_events_write on public.time_entry_events
  for all using (
    exists (select 1 from public.time_entries t
            where t.id = time_entry_events.time_entry_id
              and (is_company_admin(t.company_id) or t.user_id = auth.uid()))
  ) with check (
    exists (select 1 from public.time_entries t
            where t.id = time_entry_events.time_entry_id
              and (is_company_admin(t.company_id) or t.user_id = auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Attachments — members read; uploader or admin write/delete.
-- ---------------------------------------------------------------------------
create policy attachments_select on public.attachments
  for select using (is_company_member(company_id));
create policy attachments_insert_member on public.attachments
  for insert with check (is_company_member(company_id) and uploaded_by = auth.uid());
create policy attachments_delete_owner_or_admin on public.attachments
  for delete using (uploaded_by = auth.uid() or is_company_admin(company_id));

-- ---------------------------------------------------------------------------
-- FCM tokens & user preferences — strictly per-user.
-- notification_outbox — read own; writes via service role (edge function).
-- ---------------------------------------------------------------------------
create policy fcm_tokens_own on public.fcm_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_preferences_own on public.user_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notification_outbox_select_own on public.notification_outbox
  for select using (user_id = auth.uid());
