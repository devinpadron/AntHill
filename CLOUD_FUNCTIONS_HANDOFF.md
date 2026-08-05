# AH_Functions — v2 schema migration handoff

Paste the prompt at the bottom into a Claude session opened in `~/repos/AH_Functions`.
Everything above it is context you may want to skim first.

---

## Situation

The AntHill app (`~/repos/AntHill`, Firebase project `anthill-51de0`) is being
migrated from a nested v1 Firestore schema to a flat v2 one. **The v2 data
already exists in production** — migrated, verified, side by side with v1. The
v2 app is built but not shipped; users are still on v1 builds.

`AH_Functions` has not been touched. Every Firestore trigger still points at v1
paths. When the v2 app ships, those triggers stop firing — **silently**, because
a query against a collection that no longer receives writes returns empty rather
than erroring. No alarm, no crash, notifications just stop.

## Schema change that matters

v1 nested everything under a company and took `companyId` from the **trigger
path**. v2 is flat, and `companyId` is a **field on the document**.

| v1 trigger path                                   | v2                                 |
| ------------------------------------------------- | ---------------------------------- |
| `Companies/{companyId}/Events/{eventId}`          | `events/{eventId}`                 |
| `Companies/{companyId}/TimeEntries/{timesheetId}` | `timeEntries/{entryId}`            |
| `Companies/{companyId}/Users/{userId}`            | `memberships/{companyId}_{userId}` |

So `event.params.companyId` no longer exists — it becomes
`event.data.after.data().companyId`. That is the single change that touches every
function body, not just the trigger string.

### Field renames the functions actually read

| v1                                       | v2                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `Users/{uid}.fcmToken` (array)           | `users/{uid}.fcmTokens` (array)                                     |
| `Events.assignedWorkers`                 | `events.assignedUserIds`                                            |
| `Events.workerStatus` (map on the event) | `eventResponses/{eventId}_{userId}.status` (own documents)          |
| `Events.date` `"YYYY-MM-DD"`             | `events.dateKey` (same format)                                      |
| `Events.startTime` offset-ISO string     | `events.startAt` Timestamp                                          |
| `Events.title`                           | unchanged                                                           |
| `TimeEntries.status`                     | unchanged                                                           |
| `TimeEntries` approval fields            | `timeEntries.review = {decision, decidedBy, decidedAt, provenance}` |
| `Companies/{c}/Users/{u}.role`           | `memberships/{c}_{u}.role`, plus `.status` `"active"｜"removed"`    |

`PendingNotifications` (top-level, used by the batching util) is unchanged.

### What must NOT change

The FCM **payload contract**. The app parses `data.type`, `data.screenName`,
`data.companyId`, `data.eventId`, `data.timesheetId`, `data.userId`. Batch types
pack several ids into one comma-delimited `timesheetId` string. The app validates
`screenName` against a real route table — currently `Details`,
`TimeEntryDetails`, `EmployeeList` — and logs a warning for anything else.

Changing the payload would couple two deployments that are already hard enough to
sequence. Keep it byte-identical.

## Two live hazards

**1. Two deployed functions have no source in the repo.**
`notifyNewEventWithoutAssignees` and `notifyUserStatusChange` are live in
production. `index.js` exports only five functions and neither has a file.

A plain `firebase deploy --only functions` **deletes both**, irrecoverably —
there is no source to restore them from. Before any deploy, either recover their
source (GCP console → Cloud Functions → the function → Source) or confirm they
are dead and delete them deliberately.

**2. Deploying v2 triggers at the wrong moment causes a notification storm.**
These are `onDocumentWritten`. The bulk migration has already run, so deploying
now is safe — but the cutover plan includes a `delta` sweep that re-writes
straggler documents. If v2-path functions are live during that sweep, every
rewritten event and time entry fires a real push to real staff.

Sequence: **load data first, deploy v2 functions last.**

## Recommended approach: additive, not a swap

v1 users are still writing v1 documents and must keep getting notifications until
cutover. Mirroring how the Firestore rules were handled:

- **Add** new v2-path functions alongside the existing v1 ones, under distinct
  names (e.g. `notifyAssignedWorkersV2`).
- Both run during the transition. v1 documents fire v1 functions, v2 documents
  fire v2 functions. Nobody is double-notified because a given write only touches
  one schema.
- Delete the v1 functions at cutover cleanup, once v1 is no longer written.

## Repo facts

- `functions/index.js` exports 5: `notifyAssignedWorkers`, `notifyEventChanged`,
  `processNotificationBatches`, `notifyTimeDecision`, `notifyUserPassage`.
- All Firestore triggers are `onDocumentWritten` from
  `firebase-functions/v2/firestore`; `processNotificationBatches` is `onSchedule`.
- `src/utils/notifications.js` reads `userData.fcmToken`, sends per token, and
  prunes dead tokens by writing the filtered array back.
- `src/utils/notificationBatch.js` writes to `PendingNotifications/{userId}`.
- Deploy target: project `anthill-51de0`, default Firestore database.

---

## PROMPT — paste this into Claude in ~/repos/AH_Functions

> This repo holds the Cloud Functions for the AntHill app (Firebase project
> `anthill-51de0`). The app's Firestore schema is being migrated from a nested v1
> layout to a flat v2 one. The v2 data already exists in production alongside v1,
> and the v2 app is built but not yet shipped — users are still on v1 builds.
>
> Every Firestore trigger here still points at v1 paths, so notifications will
> stop silently when the v2 app ships. I need them working against v2.
>
> Read `CLOUD_FUNCTIONS_HANDOFF.md` (I will paste it in, or find it in the
> AntHill repo root) for the full schema mapping. The essentials:
>
> - `Companies/{companyId}/Events/{eventId}` → `events/{eventId}`
> - `Companies/{companyId}/TimeEntries/{timesheetId}` → `timeEntries/{entryId}`
> - `Companies/{companyId}/Users/{userId}` → `memberships/{companyId}_{userId}`
> - `companyId` was a PATH WILDCARD and is now a FIELD on the document, so
>   `event.params.companyId` becomes `event.data.after.data().companyId`. This
>   touches function bodies, not just trigger strings.
> - `Users.fcmToken` → `users.fcmTokens`; `assignedWorkers` →
>   `assignedUserIds`; the `workerStatus` map is now separate
>   `eventResponses/{eventId}_{userId}` documents with a `status` field.
>
> Please:
>
> 1. Start by investigating `notifyNewEventWithoutAssignees` and
>    `notifyUserStatusChange`. Both are DEPLOYED in production but have no source
>    in this repo. A plain `firebase deploy --only functions` would delete them
>    with no way to restore. Tell me what you find before changing anything —
>    this is the highest-risk item.
> 2. Add v2-path functions ALONGSIDE the existing v1 ones under distinct names,
>    rather than swapping the triggers. v1 users are still writing v1 documents
>    and must keep receiving notifications until cutover.
> 3. Keep the FCM payload contract byte-identical. The app parses `data.type`,
>    `screenName`, `companyId`, `eventId`, `timesheetId` (comma-delimited for
>    batch types), and `userId`, and validates `screenName` against the routes
>    `Details`, `TimeEntryDetails`, `EmployeeList`. Changing it would break the
>    app in ways that only show up at runtime.
> 4. Do NOT deploy without telling me first. Deploying v2 triggers before the
>    cutover data sweep would fire a real push for every migrated document.
>
> Work through it in that order and check in after step 1.
