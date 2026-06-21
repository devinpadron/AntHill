# AntHill Supabase Schema Design

> Target backend: **Supabase** (Postgres 15 + Auth + Storage + Realtime + Edge Functions).
> Goal: replace the current Firestore data model with a normalized relational schema that fits both surfaces (employee mobile app + admin web console) and supports a clean migration path off Firebase.

This document is the source of truth for the data model decisions before any code is written. SQL DDL in this doc is illustrative — the canonical version will live in `supabase/migrations/`.

---

## 1. Design principles

1. **Relational over document.** The current model leans on denormalized arrays (`assignedWorkers[]`, `packages[]`, `workerStatus{}`). These become real join tables. The cost is more joins on read; the win is queryability, integrity, and RLS that actually works.
2. **JSONB for true variability only.** Custom forms (admin-defined schemas) and form responses stay JSONB. Everything else gets columns.
3. **One company scope per row.** Every domain row has a non-null `company_id`. RLS rides on this column. Single index column to gate access — no nested subcollections, no implicit scoping.
4. **Supabase Auth is the identity source.** `auth.users` owns credentials, sessions, password resets. A `public.users` profile table mirrors it 1:1 via the same `id` UUID.
5. **UUIDs everywhere** (`gen_random_uuid()`). Stable, distributed, no Firestore-string special-casing.
6. **`timestamptz` everywhere.** Drop all ISO-string columns; let Postgres handle timezones.
7. **Soft deletes only where the product needs them** — time entries (audit) and events (because workers may have already worked them). Hard delete users, packages, labels, checklists.
8. **Audit through dedicated tables, not embedded arrays.** The current `editHistory[]` array on time entries becomes a `time_entry_edits` table.
9. **Realtime is per-table opt-in.** Publish only what the UI subscribes to. Polling is cheaper than firehose.
10. **Migration-friendly.** Every table carries a nullable `legacy_firestore_id text` during the migration window so we can backfill, verify, and dual-write.

---

## 2. Current Firestore model (reference)

The shapes we're migrating from, derived from `src/services/*` and `src/types/models/*`:

```
Users/{userId}                              { firstName, lastName, email, phone, loggedInCompany,
                                              companies[], fcmToken[] }
Users/{userId}/Preferences/settings         { defaultCalendarFilter, ... }

Companies/{companyId}                       { accessCode }
Companies/{companyId}/Users/{userId}        { role }                   // junction
Companies/{companyId}/Settings/preferences  { workWeekStarts, allowUserEventEditing,
                                              enableTimeSheet, enableAvailability,
                                              canViewEventLabels, availabilityReminder*,
                                              timeEntryForm, eventForm }

Companies/{cid}/Events/{eid}                { title, date, startTime, endTime, locations{},
                                              notes, assignedWorkers[], packages[], labelId,
                                              workerStatus{}, formResponses{} }
Companies/{cid}/Events/{eid}/Attachments    [AttachmentItem]
Companies/{cid}/Events/{eid}/Checklists/{clid}  // per-event completion state map

Companies/{cid}/EventLabels/{lid}           { name, color }

Companies/{cid}/TimeEntries/{teid}          { userId, clockInTime, clockOutTime, duration,
                                              status, pauseStartTime, totalPausedSeconds,
                                              connectedEvents[], formResponses{}, editHistory[],
                                              submittedAt, approvedBy, approvedAt, rejectedBy,
                                              rejectedAt, rejectionReason, notes }
Companies/{cid}/TimeEntries/{teid}/Attachments  [AttachmentItem]

Companies/{cid}/Packages/{pid}              { title, checklists[{checklistId,...}], ... }
Companies/{cid}/Checklists/{clid}           { title, items[{id,text}] }
```

Pain points being addressed:

- Worker assignment and status are split (`assignedWorkers[]` + `workerStatus{}` map keyed by userId). Race-prone, no FK, no per-assignment metadata.
- `locations` keyed by address string with `{lat, lng}` value — not queryable.
- `editHistory[]` array on each time entry grows unbounded inside the doc.
- Membership in two places (`Users.companies[]` and `Companies/{cid}/Users/{uid}`) — must stay in sync manually.
- No semantic types for status fields — all strings.
- Listeners are document-scoped; "all upcoming events for me across companies" is awkward.

---

## 3. Schema overview

Twelve core tables, plus three reference/audit tables.

```
auth.users (Supabase-managed)
  └─ public.users (1:1 profile)

public.companies
  └─ public.company_members          (user × company, role)
  └─ public.company_settings         (1:1 with companies, feature toggles + form schemas)
  └─ public.event_labels
  └─ public.packages
  └─ public.checklists
     └─ public.checklist_items
  └─ public.events
     ├─ public.event_workers         (event × user, with status)
     ├─ public.event_packages        (event × package, with quantity)
     ├─ public.event_checklists      (event × checklist, attached)
     └─ public.event_checklist_item_states  (per-item completion per event)
  └─ public.time_entries
     └─ public.time_entry_edits      (audit history)
  └─ public.attachments              (polymorphic: events, time_entries, users)

public.fcm_tokens
public.notification_outbox          (used by edge function → FCM)
public.user_preferences             (1:1 with users, JSONB pref bag)
```

---

## 4. Core tables (DDL)

### 4.1 Identity

```sql
-- Mirrors auth.users. Insert is triggered on auth signup (see §8).
create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  first_name      text not null,
  last_name       text not null,
  email           citext not null unique,
  phone           text,
  avatar_path     text,                     -- Supabase Storage path; never a raw URL
  active_company_id uuid references public.companies(id) on delete set null,
  legacy_firestore_id text,                 -- migration only; drop after cutover
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.users(active_company_id);
```

Notes:

- `active_company_id` replaces `loggedInCompany`. The list of companies a user belongs to is derived from `company_members`, not stored on the user row.
- `email` uses `citext` for case-insensitive uniqueness without lowercasing in app code.

### 4.2 Companies and membership

```sql
create table public.companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  access_code     text not null unique,
  legacy_firestore_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create type company_role as enum ('owner', 'manager', 'employee');

create table public.company_members (
  company_id      uuid not null references public.companies(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  role            company_role not null default 'employee',
  joined_at       timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index on public.company_members(user_id);
create index on public.company_members(company_id, role);
```

Notes:

- Composite PK makes "is user X a member of company Y?" a primary-key lookup. This is the workhorse for RLS.
- Role enum replaces `"manager" | "owner" | "user"` strings. `user` is renamed to `employee` for clarity.
- Owners and managers both have admin privileges in the app — see helper functions in §6.

### 4.3 Company settings (1:1)

```sql
create table public.company_settings (
  company_id                uuid primary key references public.companies(id) on delete cascade,
  work_week_starts          text not null default 'sunday'
                            check (work_week_starts in ('sunday','monday')),
  allow_user_event_editing  boolean not null default false,
  enable_timesheet          boolean not null default true,
  enable_availability       boolean not null default true,
  can_view_event_labels     boolean not null default true,
  availability_reminder_enabled boolean not null default false,
  availability_reminder_hours   smallint,
  availability_reminder_minutes smallint,
  time_entry_form           jsonb not null default '{"isEnabled":false,"fields":[]}'::jsonb,
  event_form                jsonb not null default '{"isEnabled":false,"fields":[]}'::jsonb,
  updated_at                timestamptz not null default now()
);
```

Why 1:1 split instead of columns on `companies`: settings churn separately from identity, and we want to subscribe to settings changes without re-publishing the whole companies table.

### 4.4 Events

```sql
create type worker_status as enum ('pending', 'confirmed', 'declined');

create table public.events (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  title           text not null,
  event_date      date not null,
  start_at        timestamptz not null,
  end_at          timestamptz,
  is_all_day      boolean not null default false,
  address         text,
  latitude        double precision,
  longitude       double precision,
  notes_workers   text,                       -- visible to workers
  notes_admin     text,                       -- admin-only notes
  label_id        uuid references public.event_labels(id) on delete set null,
  form_responses  jsonb not null default '{}'::jsonb,
  deleted_at      timestamptz,                -- soft delete
  created_by      uuid references public.users(id) on delete set null,
  legacy_firestore_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.events(company_id, event_date);
create index on public.events(company_id) where deleted_at is null;
create index on public.events(label_id);
```

Notes:

- `event_date` (date) stays alongside `start_at` (timestamptz) so calendar queries by day are fast and timezone-stable for the UI.
- Location is now first-class columns. The old `{ "123 Main St": {lat, lng} }` shape becomes `address`, `latitude`, `longitude`. Future: PostGIS column if we ever need radius search.
- `notes` splits into worker-visible vs. admin-only — currently entangled in the Event doc and shown via card components without enforcement.

### 4.5 Event workers (replaces `assignedWorkers[]` + `workerStatus{}`)

```sql
create table public.event_workers (
  event_id        uuid not null references public.events(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  status          worker_status not null default 'pending',
  assigned_at     timestamptz not null default now(),
  responded_at    timestamptz,
  primary key (event_id, user_id)
);
create index on public.event_workers(user_id, status);
```

Notes:

- Two arrays + a map collapse into one table. Adding/removing a worker is one upsert/delete; status changes don't risk array-order drift.
- The `(user_id, status)` index makes "my upcoming pending invites" cheap.

### 4.6 Packages and checklists

```sql
create table public.event_labels (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  name            text not null,
  color           text not null,             -- hex, e.g. '#6B8E23'
  legacy_firestore_id text,
  created_at      timestamptz not null default now()
);
create unique index on public.event_labels(company_id, name);

create table public.packages (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  title           text not null,
  description     text,
  legacy_firestore_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.packages(company_id);

create table public.checklists (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  title           text not null,
  legacy_firestore_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.checklists(company_id);

create table public.checklist_items (
  id              uuid primary key default gen_random_uuid(),
  checklist_id    uuid not null references public.checklists(id) on delete cascade,
  text            text not null,
  position        int not null,             -- ordering within the checklist
  created_at      timestamptz not null default now()
);
create unique index on public.checklist_items(checklist_id, position);

-- Join: a package contains many checklists
create table public.package_checklists (
  package_id      uuid not null references public.packages(id) on delete cascade,
  checklist_id    uuid not null references public.checklists(id) on delete cascade,
  position        int not null,
  primary key (package_id, checklist_id)
);

-- Join: an event uses many packages (with quantity)
create table public.event_packages (
  event_id        uuid not null references public.events(id) on delete cascade,
  package_id      uuid not null references public.packages(id) on delete restrict,
  quantity        int not null default 1 check (quantity > 0),
  primary key (event_id, package_id)
);

-- Join: an event also directly references checklists (in addition to those via packages)
create table public.event_checklists (
  event_id        uuid not null references public.events(id) on delete cascade,
  checklist_id    uuid not null references public.checklists(id) on delete restrict,
  attached_at     timestamptz not null default now(),
  primary key (event_id, checklist_id)
);

-- Per-item completion state for a specific event run
create table public.event_checklist_item_states (
  event_id        uuid not null references public.events(id) on delete cascade,
  checklist_item_id uuid not null references public.checklist_items(id) on delete cascade,
  state           smallint not null default 0 check (state in (0,1,2)),
  -- 0 = unchecked, 1 = checked, 2 = na (matches current ChecklistItemStates contract)
  updated_by      uuid references public.users(id) on delete set null,
  updated_at      timestamptz not null default now(),
  primary key (event_id, checklist_item_id)
);
```

### 4.7 Time entries

```sql
create type time_entry_status as enum (
  'active', 'paused', 'completed', 'edited',
  'pending_approval', 'approved', 'rejected'
);

create table public.time_entries (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete restrict,
  clock_in_at     timestamptz not null,
  clock_out_at    timestamptz,
  duration_seconds int,                       -- derived; nullable while active
  status          time_entry_status not null default 'active',
  pause_start_at  timestamptz,
  total_paused_seconds int not null default 0,
  notes           text,
  submission_notes text,
  form_responses  jsonb not null default '{}'::jsonb,
  submitted_at    timestamptz,
  approved_by     uuid references public.users(id) on delete set null,
  approved_at     timestamptz,
  rejected_by     uuid references public.users(id) on delete set null,
  rejected_at     timestamptz,
  rejection_reason text,
  deleted_at      timestamptz,
  legacy_firestore_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.time_entries(company_id, user_id, clock_in_at desc);
create index on public.time_entries(company_id, status) where deleted_at is null;
create unique index one_active_entry_per_user
  on public.time_entries(user_id, company_id)
  where status in ('active','paused');
```

The partial unique index enforces what the current app only enforces in code: a user can't have two active/paused entries in the same company.

```sql
-- Replaces editHistory[] array
create table public.time_entry_edits (
  id              uuid primary key default gen_random_uuid(),
  time_entry_id   uuid not null references public.time_entries(id) on delete cascade,
  edited_by       uuid not null references public.users(id) on delete restrict,
  edited_at       timestamptz not null default now(),
  previous_clock_in_at  timestamptz,
  previous_clock_out_at timestamptz,
  previous_duration_seconds int,
  previous_form_responses jsonb,
  previous_notes  text,
  summary         text
);
create index on public.time_entry_edits(time_entry_id, edited_at desc);
```

```sql
-- Replaces connectedEvents[]
create table public.time_entry_events (
  time_entry_id   uuid not null references public.time_entries(id) on delete cascade,
  event_id        uuid not null references public.events(id) on delete cascade,
  overlap_start   timestamptz not null,
  overlap_end     timestamptz not null,
  primary key (time_entry_id, event_id)
);
```

### 4.8 Attachments (polymorphic)

The current model has `Attachments` subcollections under both events and time entries. Same shape both places — collapse into one table.

```sql
create type attachment_target as enum ('event', 'time_entry', 'user_avatar');

create table public.attachments (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  target_type     attachment_target not null,
  target_id       uuid not null,             -- FK enforced by trigger; see §8
  name            text not null,
  mime_type       text not null,
  size_bytes      bigint not null,
  width           int,
  height          int,
  storage_path    text not null,             -- Supabase Storage object path
  thumbnail_path  text,
  uploaded_by     uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index on public.attachments(target_type, target_id);
create index on public.attachments(company_id);
```

Notes:

- `target_id` cannot have a real FK (it points at multiple tables). A `before insert` trigger validates that the target exists in the appropriate table and is in the same company.
- Never store URLs. Storage paths only; the client requests signed URLs on demand.

### 4.9 Notifications

```sql
create table public.fcm_tokens (
  user_id         uuid not null references public.users(id) on delete cascade,
  token           text not null,
  platform        text not null check (platform in ('ios','android','web')),
  last_seen_at    timestamptz not null default now(),
  primary key (user_id, token)
);

-- Edge function reads from this table, sends FCM, marks delivered
create table public.notification_outbox (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  type            text not null,             -- 'shift_assigned', 'time_entry_approved', etc.
  payload         jsonb not null,
  delivered_at    timestamptz,
  failed_at       timestamptz,
  error           text,
  created_at      timestamptz not null default now()
);
create index on public.notification_outbox(delivered_at, failed_at) where delivered_at is null and failed_at is null;
```

The outbox pattern decouples app writes from FCM dispatch. Inserts into `notification_outbox` can be done by row triggers (e.g. when a worker is assigned) or by edge functions handling business logic.

### 4.10 User preferences

```sql
create table public.user_preferences (
  user_id         uuid primary key references public.users(id) on delete cascade,
  prefs           jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);
```

Single JSONB column because user prefs are sparse, per-feature, and rarely queried. Known keys today: `defaultCalendarFilter`, label visibility toggles.

---

## 5. Custom forms — the JSONB contract

Custom forms are admin-defined and stored on `company_settings` (`time_entry_form`, `event_form`). Responses are stored on `time_entries.form_responses` and `events.form_responses`.

**Schema shape** (matches the existing admin builder):

```json
{
	"isEnabled": true,
	"title": "Time Entry Submission",
	"description": "Fill out before submitting your shift.",
	"fields": [
		{
			"id": "field_1738197234",
			"type": "text",
			"label": "What did you accomplish?",
			"placeholder": "...",
			"required": true
		},
		{
			"id": "field_1738197298",
			"type": "dropdown",
			"label": "Station",
			"required": false,
			"options": ["Bar", "Apps", "Dessert"]
		},
		{
			"id": "...",
			"type": "number",
			"label": "Tips received",
			"required": false
		},
		{
			"id": "...",
			"type": "checkbox",
			"label": "Closed station",
			"required": false
		},
		{
			"id": "...",
			"type": "multiline",
			"label": "Notes",
			"required": false
		}
	]
}
```

**Response shape**:

```json
{ "field_1738197234": "Set up bar, ran service", "field_1738197298": "Bar", ... }
```

**Why JSONB and not EAV (entity-attribute-value)**:

- Admins are small in number, schemas change rarely, but responses are read with the parent row 100% of the time. Pulling 8 EAV rows per time entry on payroll review would be a disaster.
- We can still query specific fields when needed: `time_entries.form_responses ->> 'field_x'`.
- GIN index on `form_responses` if we ever need to search by field value.

**Validation**: enforce at the application layer when submitting. We can optionally add a `check` constraint that `form_responses` is an object, but field-level validation lives in code.

---

## 6. Row-level security

Every domain table has RLS enabled. The base rule is: **you can read/write a row only if you are a member of its company**. Admin-only mutations layer role checks on top.

### 6.1 Helper functions

```sql
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id
      and user_id = auth.uid()
      and role in ('owner','manager')
  );
$$;
```

Both are `security definer` so they can read `company_members` without triggering its own RLS recursively.

### 6.2 Example policies

**`events`** — members read; admins write:

```sql
alter table public.events enable row level security;

create policy events_select_members on public.events
  for select using (is_company_member(company_id));

create policy events_insert_admin on public.events
  for insert with check (is_company_admin(company_id));

create policy events_update_admin on public.events
  for update using (is_company_admin(company_id))
              with check (is_company_admin(company_id));

create policy events_delete_admin on public.events
  for delete using (is_company_admin(company_id));
```

**`time_entries`** — employees can read/write _their own_; admins can read/write/approve _any_ in their company:

```sql
alter table public.time_entries enable row level security;

create policy time_entries_select_own_or_admin on public.time_entries
  for select using (
    is_company_admin(company_id) or
    (is_company_member(company_id) and user_id = auth.uid())
  );

create policy time_entries_insert_self on public.time_entries
  for insert with check (
    is_company_member(company_id) and user_id = auth.uid()
  );

create policy time_entries_update_self_or_admin on public.time_entries
  for update using (
    is_company_admin(company_id) or
    (user_id = auth.uid() and status in ('active','paused','completed'))
  );

-- Approval-only fields can be tightened via a column-level grant + a separate admin policy
-- if we want belt-and-suspenders. For MVP, the policy above is sufficient.
```

**`company_members`** — only owners change membership; everyone in a company can read it (so the app can list teammates):

```sql
create policy members_select on public.company_members
  for select using (is_company_member(company_id));

create policy members_write_owner on public.company_members
  for all using (
    exists (select 1 from public.company_members m
            where m.company_id = company_members.company_id
              and m.user_id = auth.uid()
              and m.role = 'owner')
  );
```

Managers can change roles within the app, but only owners can promote/demote _other_ owners — that finer rule belongs in an RPC, not in row-level RLS, because it depends on the _new_ role value.

### 6.3 Storage RLS

Buckets:

- `event-attachments` — path: `{company_id}/{event_id}/{filename}`
- `time-entry-attachments` — path: `{company_id}/{time_entry_id}/{filename}`
- `avatars` — path: `{user_id}/{filename}`

Policy template (events bucket):

```sql
create policy event_attachments_read on storage.objects
  for select using (
    bucket_id = 'event-attachments'
    and is_company_member((storage.foldername(name))[1]::uuid)
  );

create policy event_attachments_write on storage.objects
  for insert with check (
    bucket_id = 'event-attachments'
    and is_company_admin((storage.foldername(name))[1]::uuid)
  );
```

---

## 7. Indexes & performance

The hot paths the app drives today:

| Query                             | Index supporting it                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| Calendar for company, by month    | `events(company_id, event_date)`                                                       |
| My upcoming shifts                | `event_workers(user_id, status)` joined to `events`                                    |
| Active/paused entry for user      | partial unique `time_entries(user_id, company_id) where status in ('active','paused')` |
| Time entries for user, date range | `time_entries(company_id, user_id, clock_in_at desc)`                                  |
| Payroll review queue              | `time_entries(company_id, status) where deleted_at is null`                            |
| Unassigned upcoming events        | `events(company_id, event_date)` + filter for `not exists (event_workers...)`          |
| Attachments for an event          | `attachments(target_type, target_id)`                                                  |
| FCM dispatch loop                 | partial index on `notification_outbox(delivered_at, failed_at) where ... is null`      |

Materialized views are not needed at current scale (50-employee companies). Revisit if payroll review on a 6-month window starts slowing down.

---

## 8. Triggers

### 8.1 `updated_at` everywhere

```sql
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- Applied per-table:
create trigger users_touch    before update on public.users          for each row execute function touch_updated_at();
create trigger events_touch   before update on public.events         for each row execute function touch_updated_at();
-- ... etc for every table with updated_at
```

### 8.2 Auth → profile sync

When a user signs up via Supabase Auth, create the profile row:

```sql
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, first_name, last_name, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'first_name', ''),
          coalesce(new.raw_user_meta_data->>'last_name',  ''),
          new.email);
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
```

### 8.3 Polymorphic attachment validation

```sql
create or replace function public.validate_attachment_target() returns trigger
language plpgsql as $$
declare ok boolean;
begin
  if new.target_type = 'event' then
    select exists(select 1 from public.events where id = new.target_id and company_id = new.company_id) into ok;
  elsif new.target_type = 'time_entry' then
    select exists(select 1 from public.time_entries where id = new.target_id and company_id = new.company_id) into ok;
  elsif new.target_type = 'user_avatar' then
    select exists(select 1 from public.users where id = new.target_id) into ok;
  end if;
  if not ok then raise exception 'attachment target % % not found in company %', new.target_type, new.target_id, new.company_id; end if;
  return new;
end; $$;

create trigger attachments_validate before insert on public.attachments
  for each row execute function validate_attachment_target();
```

### 8.4 Time entry edits → audit row

When `clock_in_at`, `clock_out_at`, or `form_responses` changes on a non-active entry, write a `time_entry_edits` row capturing the previous state. Trivial trigger; skipped here for brevity.

---

## 9. Realtime

Enable `supabase_realtime` publication for tables the UI subscribes to today:

- `events` — calendar refresh
- `event_workers` — worker status changes (currently this triggered an `onSnapshot` on the whole Event doc; now it's a focused channel)
- `event_checklist_item_states` — live checklist completion
- `time_entries` — active entry + payroll review
- `company_members` — manager promotes/demotes
- `company_settings` — feature toggles flip live

Skip realtime on: `attachments`, `checklist_items`, `packages`, `time_entry_edits`, `notification_outbox`, `fcm_tokens`. Reads are on-demand.

Subscription pattern in client code:

```ts
supabase
	.channel(`events:${companyId}`)
	.on(
		"postgres_changes",
		{
			event: "*",
			schema: "public",
			table: "events",
			filter: `company_id=eq.${companyId}`,
		},
		handleChange,
	)
	.subscribe();
```

The filter is server-side. Combined with RLS, the client never receives rows it shouldn't.

---

## 10. Migration mapping (Firestore → Postgres)

| Firestore path                                | Postgres table                                     | Notes                                                        |
| --------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| `Users/{uid}`                                 | `users` (+ `auth.users` for credentials)           | Password import via Firebase Auth scrypt → Supabase one-time |
| `Users/{uid}.companies[]`                     | derived from `company_members`                     | Drop the array                                               |
| `Users/{uid}.fcmToken[]`                      | `fcm_tokens` (one row per token)                   |                                                              |
| `Users/{uid}/Preferences/settings`            | `user_preferences.prefs` (JSONB)                   |                                                              |
| `Companies/{cid}`                             | `companies`                                        | `accessCode` → `access_code`                                 |
| `Companies/{cid}/Users/{uid}`                 | `company_members`                                  | Role string → enum                                           |
| `Companies/{cid}/Settings/preferences`        | `company_settings`                                 | Columns + 2 JSONB form fields                                |
| `Companies/{cid}/Events/{eid}`                | `events` (+ `event_workers`, `event_packages`)     | `locations` flattened to `address/lat/lng`                   |
| `Events.assignedWorkers[]` + `workerStatus{}` | `event_workers` rows                               | One row per (event,user)                                     |
| `Events/.../Attachments`                      | `attachments` (`target_type='event'`)              | Files move to Supabase Storage                               |
| `Events/.../Checklists/{clid}`                | `event_checklists` + `event_checklist_item_states` | State map exploded into rows                                 |
| `Companies/{cid}/EventLabels`                 | `event_labels`                                     |                                                              |
| `Companies/{cid}/TimeEntries/{teid}`          | `time_entries`                                     | ISO strings → timestamptz; status string → enum              |
| `TimeEntry.editHistory[]`                     | `time_entry_edits` rows                            |                                                              |
| `TimeEntry.connectedEvents[]`                 | `time_entry_events` rows                           |                                                              |
| `TimeEntries/.../Attachments`                 | `attachments` (`target_type='time_entry'`)         |                                                              |
| `Companies/{cid}/Packages`                    | `packages` (+ `package_checklists`)                |                                                              |
| `Companies/{cid}/Checklists`                  | `checklists` (+ `checklist_items`)                 |                                                              |
| Firebase Storage files                        | Supabase Storage buckets                           | See §6.3                                                     |

**ID strategy**: generate new UUIDs at migration time and keep the Firestore ID in `legacy_firestore_id` for every row. Build an in-memory ID map during the migration job so foreign references resolve.

**Auth migration**: Firebase Auth exports password hashes (scrypt). Supabase Auth supports importing them — that's a one-shot operation. Plan for it specifically; users will not be prompted to reset.

---

## 11. Open questions to resolve before writing migrations

1. **Multi-event time entries.** Currently a time entry stores `connectedEvents[]` denormalized. Is there ever a case where one shift covers multiple events? If "always one event," collapse `time_entry_events` into a nullable `time_entries.event_id` column.
2. **Checklist reuse.** Today checklists are referenced via packages and (per the data) sometimes also attached directly to events. Is direct attachment used in practice, or is it always via a package? If always via package, drop `event_checklists`.
3. **Worker assignment metadata.** Should `event_workers` carry per-assignment fields the current model doesn't have (hourly rate override, role-at-this-event)? Easier to add now than later.
4. **Soft delete on events.** Does the product need to retain deleted events for payroll/audit? If not, drop `deleted_at` and hard-delete.
5. **Access code rotation.** Should `companies.access_code` be rotatable? Currently it's effectively a permanent shared secret.
6. **Per-company feature licensing.** Are feature toggles ever set by a billing layer rather than the company admin? If yes, `company_settings` may need a `managed_by_billing` flag column to prevent admin edits.

Each of these is a small decision now and a painful migration later.

---

## 12. Next steps (after this doc is approved)

1. Spin up a Supabase project (dev branch). Apply this schema as the first migration.
2. Write a seed script that creates a synthetic company with realistic data — enough to drive the redesigned admin web app end-to-end.
3. Build a Firestore → Supabase migration script (Node, using `firebase-admin` + `@supabase/supabase-js`) that handles one company end-to-end. Test on a copy of production data.
4. Implement the Supabase adapter behind the existing `src/services/*` interfaces — same exported function signatures, Supabase under the hood. This is the swap seam mentioned in the strategy discussion.
5. Stand up the admin web app against Supabase from day one — no Firestore code path. This validates the schema with a real workflow before touching the mobile app.
