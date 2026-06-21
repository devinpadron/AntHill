-- AntHill — initial schema
-- Source of truth: DB_SCHEMA_DESIGN.md (§4). Decisions resolved per §11:
--   1. A time entry CAN span multiple events  -> keep time_entry_events join table.
--   2. Checklists attach via packages AND directly -> keep event_checklists.
--   3. event_workers carries per-assignment fields -> hourly_rate + role_at_event.
--   4. Events are soft-deleted (payroll/audit) -> events.deleted_at retained.
--   - access_code is a permanent shared secret (no rotation column).
--   - No billing-managed feature flag on company_settings.
--
-- Every domain row carries company_id (RLS rides on it) and a nullable
-- legacy_firestore_id for the migration window. Timestamps are timestamptz.

-- Keep extensions out of the public schema (Supabase advisor 0014).
create schema if not exists extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;
-- gen_random_uuid() is built-in (pg_catalog) in PG13+, so table defaults below
-- need no schema qualification; only the citext type is qualified.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type company_role as enum ('owner', 'manager', 'employee');
create type worker_status as enum ('pending', 'confirmed', 'declined');
create type time_entry_status as enum (
  'active', 'paused', 'completed', 'edited',
  'pending_approval', 'approved', 'rejected'
);
create type attachment_target as enum ('event', 'time_entry', 'user_avatar');

-- ---------------------------------------------------------------------------
-- Companies (created first; users reference it via active_company_id)
-- ---------------------------------------------------------------------------
create table public.companies (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  access_code         text not null unique,
  legacy_firestore_id text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Identity — mirrors auth.users (profile row created by trigger on signup)
-- ---------------------------------------------------------------------------
create table public.users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  first_name          text not null,
  last_name           text not null,
  email               extensions.citext not null unique,
  phone               text,
  avatar_path         text,                 -- Storage path; never a raw URL
  active_company_id   uuid references public.companies(id) on delete set null,
  legacy_firestore_id text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index users_active_company_idx on public.users(active_company_id);

-- ---------------------------------------------------------------------------
-- Membership (user × company, role)
-- ---------------------------------------------------------------------------
create table public.company_members (
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  role        company_role not null default 'employee',
  joined_at   timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index company_members_user_idx on public.company_members(user_id);
create index company_members_company_role_idx on public.company_members(company_id, role);

-- ---------------------------------------------------------------------------
-- Company settings (1:1)
-- ---------------------------------------------------------------------------
create table public.company_settings (
  company_id                    uuid primary key references public.companies(id) on delete cascade,
  work_week_starts              text not null default 'sunday'
                                check (work_week_starts in ('sunday', 'monday')),
  allow_user_event_editing      boolean not null default false,
  enable_timesheet              boolean not null default true,
  enable_availability           boolean not null default true,
  can_view_event_labels         boolean not null default true,
  availability_reminder_enabled boolean not null default false,
  availability_reminder_hours   smallint,
  availability_reminder_minutes smallint,
  time_entry_form               jsonb not null default '{"isEnabled":false,"fields":[]}'::jsonb,
  event_form                    jsonb not null default '{"isEnabled":false,"fields":[]}'::jsonb,
  updated_at                    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Event labels
-- ---------------------------------------------------------------------------
create table public.event_labels (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  name                text not null,
  color               text not null,        -- hex, e.g. '#6B8E23'
  legacy_firestore_id text,
  created_at          timestamptz not null default now()
);
create unique index event_labels_company_name_idx on public.event_labels(company_id, name);

-- ---------------------------------------------------------------------------
-- Packages & checklists
-- ---------------------------------------------------------------------------
create table public.packages (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  title               text not null,
  description         text,
  legacy_firestore_id text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index packages_company_idx on public.packages(company_id);

create table public.checklists (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  title               text not null,
  legacy_firestore_id text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index checklists_company_idx on public.checklists(company_id);

create table public.checklist_items (
  id           uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  text         text not null,
  position     int not null,                -- ordering within the checklist
  created_at   timestamptz not null default now()
);
create unique index checklist_items_position_idx on public.checklist_items(checklist_id, position);

-- A package contains many checklists
create table public.package_checklists (
  package_id   uuid not null references public.packages(id) on delete cascade,
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  position     int not null,
  primary key (package_id, checklist_id)
);

-- ---------------------------------------------------------------------------
-- Events (soft-deleted; locations flattened to columns)
-- ---------------------------------------------------------------------------
create table public.events (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies(id) on delete cascade,
  title               text not null,
  event_date          date not null,
  start_at            timestamptz not null,
  end_at              timestamptz,
  is_all_day          boolean not null default false,
  address             text,
  latitude            double precision,
  longitude           double precision,
  notes_workers       text,                 -- visible to workers
  notes_admin         text,                 -- admin-only notes
  label_id            uuid references public.event_labels(id) on delete set null,
  form_responses      jsonb not null default '{}'::jsonb,
  deleted_at          timestamptz,          -- soft delete (§11.4)
  created_by          uuid references public.users(id) on delete set null,
  legacy_firestore_id text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index events_company_date_idx on public.events(company_id, event_date);
create index events_company_live_idx on public.events(company_id) where deleted_at is null;
create index events_label_idx on public.events(label_id);

-- Event workers (replaces assignedWorkers[] + workerStatus{}); carries
-- per-assignment fields per §11.3.
create table public.event_workers (
  event_id      uuid not null references public.events(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  status        worker_status not null default 'pending',
  hourly_rate   numeric(10, 2),            -- per-assignment pay override (§11.3)
  role_at_event text,                       -- role for this specific event (§11.3)
  assigned_at   timestamptz not null default now(),
  responded_at  timestamptz,
  primary key (event_id, user_id)
);
create index event_workers_user_status_idx on public.event_workers(user_id, status);

-- An event uses many packages (with quantity)
create table public.event_packages (
  event_id   uuid not null references public.events(id) on delete cascade,
  package_id uuid not null references public.packages(id) on delete restrict,
  quantity   int not null default 1 check (quantity > 0),
  primary key (event_id, package_id)
);

-- An event also directly references checklists (kept per §11.2)
create table public.event_checklists (
  event_id     uuid not null references public.events(id) on delete cascade,
  checklist_id uuid not null references public.checklists(id) on delete restrict,
  attached_at  timestamptz not null default now(),
  primary key (event_id, checklist_id)
);

-- Per-item completion state for a specific event run
-- state: 0 = unchecked, 1 = checked, 2 = na (matches ChecklistItemStates)
create table public.event_checklist_item_states (
  event_id          uuid not null references public.events(id) on delete cascade,
  checklist_item_id uuid not null references public.checklist_items(id) on delete cascade,
  state             smallint not null default 0 check (state in (0, 1, 2)),
  updated_by        uuid references public.users(id) on delete set null,
  updated_at        timestamptz not null default now(),
  primary key (event_id, checklist_item_id)
);

-- ---------------------------------------------------------------------------
-- Time entries (soft-deleted; one active/paused per user per company)
-- ---------------------------------------------------------------------------
create table public.time_entries (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete cascade,
  user_id              uuid not null references public.users(id) on delete restrict,
  clock_in_at          timestamptz not null,
  clock_out_at         timestamptz,
  duration_seconds     int,                 -- derived; nullable while active
  status               time_entry_status not null default 'active',
  pause_start_at       timestamptz,
  total_paused_seconds int not null default 0,
  notes                text,
  submission_notes     text,
  form_responses       jsonb not null default '{}'::jsonb,
  submitted_at         timestamptz,
  approved_by          uuid references public.users(id) on delete set null,
  approved_at          timestamptz,
  rejected_by          uuid references public.users(id) on delete set null,
  rejected_at          timestamptz,
  rejection_reason     text,
  deleted_at           timestamptz,
  legacy_firestore_id  text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index time_entries_user_idx on public.time_entries(company_id, user_id, clock_in_at desc);
create index time_entries_status_idx on public.time_entries(company_id, status) where deleted_at is null;
create unique index one_active_entry_per_user
  on public.time_entries(user_id, company_id)
  where status in ('active', 'paused');

-- Replaces editHistory[]
create table public.time_entry_edits (
  id                        uuid primary key default gen_random_uuid(),
  time_entry_id             uuid not null references public.time_entries(id) on delete cascade,
  edited_by                 uuid not null references public.users(id) on delete restrict,
  edited_at                 timestamptz not null default now(),
  previous_clock_in_at      timestamptz,
  previous_clock_out_at     timestamptz,
  previous_duration_seconds int,
  previous_form_responses   jsonb,
  previous_notes            text,
  summary                   text
);
create index time_entry_edits_idx on public.time_entry_edits(time_entry_id, edited_at desc);

-- Replaces connectedEvents[] (kept per §11.1 — a shift can span events)
create table public.time_entry_events (
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  event_id      uuid not null references public.events(id) on delete cascade,
  overlap_start timestamptz not null,
  overlap_end   timestamptz not null,
  primary key (time_entry_id, event_id)
);

-- ---------------------------------------------------------------------------
-- Attachments (polymorphic; target validated by trigger)
-- ---------------------------------------------------------------------------
create table public.attachments (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  target_type    attachment_target not null,
  target_id      uuid not null,             -- FK enforced by trigger
  name           text not null,
  mime_type      text not null,
  size_bytes     bigint not null,
  width          int,
  height         int,
  storage_path   text not null,             -- Storage object path
  thumbnail_path text,
  uploaded_by    uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index attachments_target_idx on public.attachments(target_type, target_id);
create index attachments_company_idx on public.attachments(company_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.fcm_tokens (
  user_id      uuid not null references public.users(id) on delete cascade,
  token        text not null,
  platform     text not null check (platform in ('ios', 'android', 'web')),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, token)
);

create table public.notification_outbox (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  type         text not null,               -- 'shift_assigned', 'time_entry_approved', ...
  payload      jsonb not null,
  delivered_at timestamptz,
  failed_at    timestamptz,
  error        text,
  created_at   timestamptz not null default now()
);
create index notification_outbox_pending_idx
  on public.notification_outbox(delivered_at, failed_at)
  where delivered_at is null and failed_at is null;

-- ---------------------------------------------------------------------------
-- User preferences (1:1, sparse JSONB bag)
-- ---------------------------------------------------------------------------
create table public.user_preferences (
  user_id    uuid primary key references public.users(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
