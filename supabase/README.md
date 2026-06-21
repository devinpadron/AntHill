# AntHill — Supabase

Migrations that replace the Firestore backend with a normalized Postgres schema.
Design source of truth: [`../DB_SCHEMA_DESIGN.md`](../DB_SCHEMA_DESIGN.md).

## Migrations (applied in order)

| File | Contents |
|---|---|
| `20260620000001_initial_schema.sql` | Extensions, enums, all tables + indexes |
| `20260620000002_rls.sql` | `is_company_member` / `is_company_admin` helpers + RLS policies |
| `20260620000003_triggers.sql` | `updated_at`, auth→profile sync, attachment validation, time-entry edit audit |
| `20260620000004_realtime.sql` | Realtime publication for the 6 subscribed tables |
| `20260620000005_storage.sql` | Storage buckets (`event-attachments`, `time-entry-attachments`, `avatars`) + path RLS |

All migrations were applied to a throwaway Supabase project and run through the
security + performance advisors. Remediations are folded into the files above:
extensions live in the `extensions` schema, functions pin `search_path`, the
auth-trigger function is not API-callable, RLS policies are scoped
`to authenticated`, `auth.uid()` is wrapped `(select auth.uid())` (initplan),
admin writes are split per-action to avoid overlapping permissive policies, and
the membership helpers are `STABLE`.

## Resolved schema decisions (DB_SCHEMA_DESIGN.md §11)

1. **A time entry can span multiple events** → kept the `time_entry_events` join table.
2. **Checklists attach via packages _and_ directly** → kept `event_checklists`.
3. **Per-assignment worker fields** → `event_workers.hourly_rate` + `role_at_event`.
4. **Events are soft-deleted** → `events.deleted_at` retained for payroll/audit.
- `companies.access_code` is a permanent shared secret (no rotation column).
- No billing-managed feature flag on `company_settings`.

## Applying

This has not been applied to any project yet. To stand up a dev environment:

```bash
# from the repo root
supabase init           # if supabase/config.toml doesn't exist yet (won't touch migrations)
supabase link --project-ref <ref>
supabase db push        # applies the migrations above in order
supabase gen types typescript --linked > src/types/supabase.ts   # generate client types
```

For local development: `supabase start` then `supabase db reset` applies all
migrations against the local stack.

## Not yet written (next steps in Workstream B)

- **Onboarding RPC** — create-company / join-by-access-code as `security definer`
  functions (RLS intentionally restricts direct membership writes to owners).
- **Notification edge function** — drains `notification_outbox` → FCM.
- **Seed script** — synthetic company with realistic data for the web console.
- **Firestore → Supabase migration job** — Node (`firebase-admin` +
  `@supabase/supabase-js`) over `scripts/firestore-export.json`, generating
  UUIDs and preserving `legacy_firestore_id`; one company end-to-end first.
- **Supabase adapter** behind `src/services/*` (the seam from commit `9c38ebe`).
