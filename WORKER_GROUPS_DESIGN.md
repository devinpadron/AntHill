# Worker groups and targeted availability

Some workers are purely 1099 and should only see jobs designated for them.
Before this, every member of a company saw every unassigned upcoming event and
could confirm or decline it.

## Model

```
groups/{groupId}
  { id, companyId, name, joinCode|null, joinVisibility, ... }

groupJoinCodes/{code}          // the document id IS the code
  { code, companyId, groupId, visibility, createdAt }

memberships/{companyId}_{userId}
  + visibility: "open" | "restricted"     // default "open"
  + groupIds: string[]                    // default []
  + joinedViaCode?: string                // the code that placed them there

events/{eventId}
  + audienceGroupIds: string[]            // default []
  + audienceUserIds: string[]             // default []
  + isTargeted: boolean                   // either list non-empty
```

An event's audience is the UNION of the two lists. Groups cover the standing
case ("all bartenders"); named users cover the one-off a group cannot express
("this bartender, because they worked the venue last month"). Someone reachable
both ways is invited once.

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

Publishing an event writes one `eventResponses` document per targeted worker —
every member of the named groups, plus anyone named individually
(`syncEventAudience`).

This is what makes the restriction real rather than cosmetic: **a worker with
no invitation has no document, so there is nothing for their availability
screen to find.** It is a property of the data, not a filter a future caller
can forget to apply.

Re-running is safe. Existing invitations are left alone, so re-saving an event
never resets a reply that already came in. Retraction is narrow on purpose:
dropping a group or a name withdraws only invitations nobody has answered. A
worker who already confirmed or declined keeps their response, because that
answer is real information a manager may be looking at.

Retraction is also skipped entirely when the audience is empty. An empty
audience means the event went back to being open to everyone, and an open event
does not use invitations to control who sees it — so there is nothing to
withdraw. Retracting anyway would delete every unanswered response on the
event, and migrated records are exactly that shape (`status: "pending"`,
`respondedAt: null`): editing the date on an old event would have silently
erased the record that those workers had been asked.

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

## Join codes

A group can carry its own join code. Someone who joins with it lands in the
company _and_ in that group, with the visibility the manager picked — so a 1099
contractor is restricted from their first launch instead of depending on
someone remembering to set it afterwards.

One field accepts both kinds of code, at signup and at "Join company" alike.
The company access code is tried first, so an existing code can never be
shadowed by a group code that collides.

### Why this does not reintroduce self-assignment

The membership `create` rule pins `groupIds == []` precisely so a joiner cannot
name any group they like — group ids are readable by every member. A code has
to beat that guard without weakening it.

`groupJoinCodes/{code}` uses **the code as the document id**. `get` is open to
any signed-in user because addressing the document already requires knowing the
code — that is the credential — and `list` is denied, so the collection cannot
be enumerated. The joiner writes the code onto their own membership, and
`v2JoinedViaValidCode` checks it resolves to that company, that one group, and
that visibility.

The design rests on `create` applying **only to a document that does not
exist**. Removal is a status change rather than a delete, so no current or
former member can ever take the join path again; changing your own groups still
requires `update`, which is manager-only. Eight rules tests cover the attacks:
naming a group with no code, a made-up code, a real code pointed at a different
group, a code claiming extra groups, a code claiming a softer visibility, a
code replayed against another company, an existing member re-grouping
themselves, and enumerating the collection. All eight were confirmed by
injection.

**Residual, accepted:** `joinedViaCode` persists on the membership, and members
can read each other's memberships, so a member can learn their company's group
codes. They cannot use one themselves — there is no create path left for them —
but they could pass it to an outsider, who would land in that group rather than
ungrouped. Compare to today: that member can already pass on the company access
code, so the marginal leak is _which group_, inside a company they could already
let someone into. Managers rotate codes from the Worker Groups screen. Closing
it properly means doing the join in a Cloud Function with admin credentials,
which is the upgrade path if it ever matters.

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
