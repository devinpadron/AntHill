# Supabase service adapter — cutover plan

Goal: reimplement `src/services/*` on `@supabase/supabase-js` behind the
**same exported signatures**, so screens/hooks/contexts don't change. This is
the seam established in commit `9c38ebe` (all data access already routes through
the service layer).

## Why the cutover is atomic

Auth and data are interdependent: `UserContext` authenticates and then
subscribes to the user's data. You can't run Supabase auth with Firestore data
(or vice-versa). So the swap happens in one branch/PR, not service-by-service in
`main`. Until then, the Supabase modules live in `src/services/supabase/` as
**shadow** implementations and are not imported by the app.

## Foundation in place

- `src/lib/supabase.ts` — the client (AsyncStorage session persistence, anon key
  from `app.config.js` → `extra.SUPABASE_URL` / `SUPABASE_ANON_KEY`).
- `package.json` — `@supabase/supabase-js`, `react-native-url-polyfill`,
  `expo-constants`.
- `src/services/supabase/authService.ts` — reference conversion (the pattern).
- Generated types: run `supabase gen types typescript --linked > src/types/database.ts`
  once a project is linked, then type the client `createClient<Database>(…)`.

## Per-service mapping

| Service | Firestore today | Supabase target |
|---|---|---|
| `authService` | `@react-native-firebase/auth` | `supabase.auth.*` (done — shadow). Add a `delete_own_account` RPC/edge fn. |
| `userService` | `Users/{uid}` docs, `onSnapshot` | `users` table; `subscribeCurrentUser`/`subscribeUserPrivilege` → `supabase.channel('users:'+id)` / `company_members`. `swapUserCompany` → update `users.active_company_id`. Preferences → `user_preferences`. |
| `companyService` | `Companies/*`, junction `Users` subcol | `companies`/`company_members`/`company_settings`. `compareAccessCode`/`joinCompanyWithAccessCode` → `rpc('join_company_with_code')`; create-company → `rpc('create_company_with_owner')`. `changeUserRole` → update `company_members.role`. |
| `eventService` | `Events/*`, `onSnapshot` | `events` (+ `event_workers`, `event_packages`, `event_checklists`); `subscribeAllEvents`/`subscribeEvent` → `channel('events:'+companyId)`. Labels → `event_labels`. Checklists → `checklists`/`checklist_items`. |
| `timeEntryService` | `TimeEntries/*` | `time_entries`; clock in/out/pause = inserts/updates; `getActiveTimeEntry` uses the partial-unique active row. Audit via the DB trigger (drop the client `editHistory` write). |
| `availabilityService` | events + `workerStatus{}` | `event_workers` (status + `(user_id,status)` index); confirm/decline → update own `event_workers` row (RLS allows self-update). |
| `packageService` | `Packages/*` | `packages` + `package_checklists`. |
| `agendaItemService` | event queries | `events` queries by `company_id, event_date`. |
| `notificationService` | FCM + token on user doc | `fcm_tokens` table; reads from `notification_outbox`; FCM dispatch moves to an edge function draining the outbox. |
| `storageService` | Firebase Storage + Attachments subcol | Supabase Storage buckets (`event-attachments`/`time-entry-attachments`/`avatars`) + `attachments` table. Upload → `supabase.storage.from(bucket).upload`; metadata row insert. |
| `exportService` | reads Firestore | reads `time_entries` (+ joins); CSV/PDF logic unchanged. |
| `appService` | `AppData/Data.required_version` | No table yet — add a small `app_config` table or use Supabase remote config; decide at cutover. |

## Realtime pattern

```ts
const channel = supabase
  .channel(`events:${companyId}`)
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "events", filter: `company_id=eq.${companyId}` },
    handleChange,
  )
  .subscribe();
// cleanup: supabase.removeChannel(channel)
```

The existing `subscribe*` services return an unsubscribe function — keep that
contract (`return () => supabase.removeChannel(channel)`).

## Contexts to update at cutover

- `UserContext` — `auth.onAuthStateChanged` → `supabase.auth.onAuthStateChange`;
  `subscribeCurrentUser`/`subscribeUserPrivilege` use channels; `companyId`
  comes from `users.active_company_id` + `company_members`.
- `CompanyContext` — already routes through `companyService`; no change beyond
  the service internals.
- `NotificationContext` — FCM listener stays; token persistence → `fcm_tokens`.
- `UploadManagerContext` — already routes through `storageService`; convert the
  service internals to Supabase Storage.

## Error handling

Supabase errors expose `error.message` / `error.status`, not Firebase
`error.code`. Update the `handleAuthError` switches in `useAuth`/`useSignUp`
(and `authUtils`) to map Supabase messages/status codes.

## Cutover steps

1. Link a Supabase project; `supabase db push`; `supabase gen types typescript`.
2. Finish `src/services/supabase/*` for every service above (signatures match).
3. Flip the imports (a barrel re-export, or path alias) from Firebase services
   to Supabase services; update the four contexts.
4. Update auth error mapping.
5. Run the migration job (`scripts/migrate-to-supabase.js`) on a data copy;
   verify row counts + `legacy_firestore_id`.
6. Import Firebase scrypt password hashes; copy Storage objects; backfill
   `attachments.storage_path`.
7. Remove `@react-native-firebase/*` and `src/constants/firestore.js`.
