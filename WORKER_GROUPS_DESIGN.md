# Worker groups and targeted availability — design

**Status: designed, not implemented.** Written before cutover because the
schema additions are cheapest to make while a migration is already running.

## Problem

Every member of a company currently sees every unassigned upcoming event and
can confirm or decline it. `getUnassignedUpcomingEvents` filters only on
`companyId`, `assignedCount == 0` and `dateKey`, and the `eventResponses` rule
lets any active member write their own response for any event.

Some workers are purely 1099 and should only see jobs designated for them.

## Model

Three additions, all additive to the v2 schema.

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

`isTargeted` is a denormalized boolean because Firestore cannot query on array
length, and the open-worker query needs to exclude targeted events.

### Visibility rules

|                       | untargeted event            | targeted event  |
| --------------------- | --------------------------- | --------------- |
| **open** worker       | sees it (today's behaviour) | only if invited |
| **restricted** worker | does not see it             | only if invited |

So an untargeted event behaves exactly as it does today for existing staff —
no backfill of behaviour, nothing changes for W2 workers. A restricted worker
sees nothing until someone designates work for them.

### Invitations

Publishing an event to a group creates one `eventResponses` document per member
of that group, with `status: "pending"`. That collection already exists and
already carries the right rule (`userId == uid()` on write, composite id).

This is what makes the guarantee real rather than cosmetic: **a worker with no
invitation has no document, so there is nothing for their availability screen
to find.** It is not a filter that can be omitted — it is absence of data.

Fan-out is one write per invited worker per event. The largest company has 65
members; the migration already created 2,206 response documents, so this is
well within normal.

## Queries

```ts
// restricted worker — invitations only
eventResponses
	.where("companyId", "==", companyId)
	.where("userId", "==", userId)
	.where("status", "==", "pending")
	.where("dateKey", ">=", today);

// open worker — the above, plus untargeted events as today
events
	.where("companyId", "==", companyId)
	.where("assignedCount", "==", 0)
	.where("isTargeted", "==", false)
	.where("dateKey", ">=", today)
	.orderBy("dateKey");
```

The first is already indexed (`eventResponses: companyId, userId, status,
dateKey`). The second needs one new composite:

```
events: companyId ASC, assignedCount ASC, isTargeted ASC, dateKey ASC
```

## Rules

Two changes, both statically evaluable:

```
match /events/{eventId} {
  // A targeted event can only be fetched by someone invited to it or
  // assigned to it. Single-document reads are fully enforced.
  allow get: if v2IsMember(resource.data.companyId)
             && (resource.data.isTargeted != true
                 || uid() in resource.data.assignedUserIds
                 || exists(/databases/$(database)/documents/eventResponses/$(eventId + "_" + uid())));
}

match /eventResponses/{responseId} {
  // Responding requires an existing invitation. Creating one from nothing is
  // how a restricted worker would otherwise opt themselves in.
  allow create: if v2IsManager(request.resource.data.companyId);
  allow update: if v2IsMember(resource.data.companyId)
                && resource.data.userId == uid()
                && request.resource.data.diff(resource.data)
                     .affectedKeys().hasOnly(["status","respondedAt","updatedAt"]);
}
```

Note the create/update split. Today a worker creates their own response
document; under this model the manager creates it as an invitation and the
worker may only change its `status`. That is the enforcement point.

### What this does and does not guarantee

**Enforced by rules:** a restricted worker cannot respond to a job they were
not invited to, and cannot fetch a targeted event document by id.

**Enforced by the service layer only:** a determined restricted worker issuing
a raw _list_ query against `events` could still enumerate titles and dates for
their company. Firestore evaluates list queries against their potential result
set, so a rule cannot filter them by a per-caller group predicate without
rejecting the query outright — the same mechanic behind three permission bugs
already fixed in this migration.

Closing that too would mean either denying `list` on events to restricted
members entirely (which breaks their own calendar, since that is also a list
query) or moving targeted events to a separate collection. Neither is worth it
for contractor segmentation, where the exposure is via raw API access rather
than the app — but the line should be known rather than assumed.

## Migration impact

`isTargeted` must be **backfilled to `false` on all 657 existing events**.
Firestore equality queries exclude documents that lack the field entirely, so
without it the open-worker query returns nothing.

This is the reason to do it now: the transforms already run over every event,
so adding two fields costs nothing extra. Doing it after cutover means a
separate backfill pass over live data.

`memberships.visibility` defaults to `"open"` and `groupIds` to `[]`, so
existing workers are unaffected.

## Work

1. `groups` collection, service, and admin CRUD screen
2. Group assignment in the member list
3. `visibility` toggle on a membership
4. Group picker on the event form; publishing writes invitations
5. Split the availability query by `visibility`
6. Rules + tests for the create/update split and targeted `get`
7. Transform change for `audienceGroupIds` / `isTargeted`, plus the new index

Items 1–5 are ordinary feature work. Item 7 is the only one that is cheaper
before cutover than after.
