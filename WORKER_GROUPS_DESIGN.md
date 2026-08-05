# Worker groups and targeted availability

Some workers are purely 1099 and should only see jobs designated for them.
Before this, every member of a company saw every unassigned upcoming event and
could confirm or decline it.

## Model

```
groups/{groupId}
  { id, companyId, name, createdAt, updatedAt, schemaVersion }

memberships/{companyId}_{userId}
  + visibility: "open" | "restricted"     // default "open"
  + groupIds: string[]                    // default []

events/{eventId}
  + audienceGroupIds: string[]            // default []
  + isTargeted: boolean                   // audienceGroupIds.length > 0
```

`isTargeted` is denormalized because Firestore cannot query on array length,
and the open-availability query has to exclude targeted events.

Group membership lives on the membership document rather than in a roster on
the group, so the member list stays one query and publishing an event can
resolve a group to its workers without a join.

### Visibility

|                       | untargeted event                       | targeted event  |
| --------------------- | -------------------------------------- | --------------- |
| **open** worker       | sees it (behaviour before this change) | only if invited |
| **restricted** worker | does not see it                        | only if invited |

An untargeted event behaves exactly as it always has, so nothing changed for
existing staff and no behavioural backfill was needed. A restricted worker sees
nothing until someone designates work for them.

### Invitations

Publishing an event to a group writes one `eventResponses` document per member
of that group, with `status: "pending"` (`syncEventAudience`).

This is what makes the restriction real rather than cosmetic: **a worker with
no invitation has no document, so there is nothing for their availability
screen to find.** It is a property of the data, not a filter a future caller
can forget to apply.

Re-running is safe. Existing invitations are left alone, so re-saving an event
never resets a reply that already came in. Retraction is narrow on purpose:
removing a group withdraws only invitations nobody has answered. A worker who
already confirmed or declined keeps their response, because that answer is real
information a manager may be looking at.

## Queries

```ts
// restricted worker — invitations only
// open worker — the above, plus untargeted unassigned events as before
events
	.where("companyId", "==", companyId)
	.where("assignedCount", "==", 0)
	.where("isTargeted", "==", false)
	.where("dateKey", ">=", today)
	.orderBy("dateKey");
```

`getAvailabilityEvents` unions the two branches, dedupes, and narrows both to
`assignedCount === 0` — availability is about jobs nobody is on yet.

New composite indexes:

```
events:      companyId · assignedCount · isTargeted · dateKey
memberships: companyId · status · groupIds[]
memberships: companyId · groupIds[]
groups:      companyId · name
```

## Enforcement

**The create/update split on `eventResponses` is the load-bearing rule.**
Before this, a worker created their own response document. A manager now
creates it as an invitation, and a worker may only change its `status`:

```
allow create: if responseId == eventId + "_" + userId
              && (v2IsManager(companyId)
                  || (v2IsMember(companyId) && userId == uid()
                      && v2EventIsOpen(eventId)));

allow update: if v2IsManager(companyId)
              || (isSelf(resource.data.userId)
                  && diff.affectedKeys()
                       .hasOnly(["status","respondedAt","updatedAt","dateKey"]));
```

Without the split, a restricted worker simply writes their own response for a
targeted event and opts themselves in — the group becomes a suggestion.

`events` splits `read` into `get` and `list`. A targeted event can only be
fetched by a manager, an assignee, or an invitation holder. `memberships`
already refused a worker's own `visibility`/`groupIds` via `hasOnly`; the
`create` rule now pins both, so a worker cannot join pre-grouped.

`v2EventIsOpen` reads `isTargeted` with a default, because a missing map key
raises an error in rules — which denies rather than falling through.

### What this does and does not guarantee

**Enforced by rules:** a restricted worker cannot respond to a job they were
not invited to, and cannot fetch a targeted event document by id.

**Enforced by the service layer only:** a determined restricted worker issuing
a raw _list_ query against `events` could still enumerate titles and dates for
their own company. Firestore evaluates list queries against their potential
result set, so a rule cannot filter them by a per-caller group predicate
without rejecting the query outright — the same mechanic behind three
permission bugs already fixed in this migration.

Closing that would mean denying `list` on events to restricted members
entirely, which breaks their own calendar, since that is a list query too. Not
worth it for contractor segmentation, where the exposure is via raw API access
rather than the product — but the line should be known rather than assumed.

## Migration

`isTargeted`/`audienceGroupIds` are written onto every event and
`visibility`/`groupIds` onto every membership, explicitly rather than by
default. A Firestore equality filter does not match documents where the field
is absent, so an event without `isTargeted: false` drops out of the
open-availability query and stops existing for every worker.

Two `verify` invariants test for the _presence_ of these fields rather than
their value, because absent and false are indistinguishable in every other
check. Both were validated against a known violation: run against the
pre-change `test` data they fail on 657 events and 90 memberships.

`joinCompanyWithAccessCode` writes both membership fields for the same reason.

## Where it lives

|                                                    |                                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/services/v2/groupService.ts`                  | group CRUD, group→member resolution, visibility                                         |
| `src/services/v2/eventService.ts`                  | `syncEventAudience`, `getOpenUpcomingEvents`, `getEventsByIds`, `getAvailabilityEvents` |
| `src/hooks/v2/useGroups.ts`                        | live group list                                                                         |
| `src/screens/settings/admin/v2/WorkerGroups.tsx`   | create / rename / delete, headcounts                                                    |
| `src/screens/settings/admin/v2/EmployeeList.tsx`   | per-worker "Job access" sheet                                                           |
| `src/screens/calendar/v2/EventSubmit.tsx`          | "Who can see this job" picker                                                           |
| `src/screens/availability/v2/AvailabilityPage.tsx` | split availability query                                                                |

## Known gaps

- **`Alert.prompt` is iOS-only**, so renaming a group is a no-op on Android.
  Android is out of scope (all users are on iOS), and the call is written
  `Alert.prompt?.()` so it cannot crash — but it would need a modal before any
  Android release.
- **Editing an event still does not seed its saved packages or label** into the
  form. That predates this work and is untouched here; `audienceGroupIds` _is_
  seeded, because an unseeded picker would have submitted `[]` on every edit
  and silently withdrawn every pending invitation.
