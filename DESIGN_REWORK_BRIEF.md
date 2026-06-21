# AntHill Design Rework Brief

> **Hand-off prompt for Claude Design**
> Target: redesign the AntHill product as **two distinct surfaces** — a polished mobile-first employee app and a brand-new admin web console.

---

## 1. Product context

**AntHill** is an offsite employee management tool for small catering businesses (teams of ~5–50). Owners/managers schedule events, assign workers, run payroll, and configure the company. Employees clock in/out, view their schedule, mark availability, and complete event checklists.

Today AntHill ships as a single React Native app (Expo SDK 52, iOS + Android). Admin and employee functionality are entangled in one codebase, conditionally gated by an `isAdmin` flag (`Role.MANAGER || Role.OWNER`). This rework splits the product into two surfaces and modernizes the visual language of both.

The two roles use the product very differently:

- **Employees** are on the move, on phones, at event sites. They need fast, one-handed, glanceable interactions (clock in, see today's shift, check off tasks).
- **Managers/owners** sit at a desk planning weeks ahead. They need dense, multi-pane, keyboard-driven workflows (drag-assign workers, approve payroll, build forms).

A single mobile app cannot serve both well. Hence the split.

---

## 2. Goals of this rework

1. **Split admin out of the mobile app** into a separate web console. Remove all admin-only screens from React Native.
2. **Redesign the employee mobile app** with a distinctive, modern visual identity — the current UI is functional but generic.
3. **Design the admin web app from scratch** for desktop-first workflows. This is greenfield UI, not a port of mobile screens to a bigger viewport.
4. **Establish one shared design language** (tokens, brand, components) that lives across both surfaces, while letting each surface be native to its form factor.
5. **Keep the existing brand DNA** — warm earthy palette, lowercase "anthill" wordmark, ant motif — but elevate it.

---

## 3. Current state — what exists today

### 3.1 Tech stack

- React Native 0.76 + Expo SDK 52, TypeScript
- React Navigation v6 (bottom tabs + native stack)
- Firebase: Auth, Firestore (real-time), Storage, Cloud Messaging, Crashlytics
- State via React Context (User, Company, Theme, Notification, UploadManager)
- Multi-company support: a user can belong to several companies; one is "active" at a time
- Design tokens already exist at `src/constants/colors.ts` and `src/constants/tokens.ts`
- A partial UI primitives library exists at `src/components/ui/` (Button, Card, Avatar, Badge, FormInput, AppHeader, etc.)

### 3.2 Existing brand palette

```
AntHill core:
  Black  #1D1D27   White  #DBDCD7   Cream  #E9E1D6
  Khaki  #B5A291   Green  #2F3B16

Light mode app:
  Background   #FAF6F0   Card       #FFFFFF
  PrimaryText  #1D1D27   Secondary  #666666
  Border       #D0C0B0   FAB Green  #6B8E23
  Date badge   #F5F0E8   Search bar #D4C5B3

Dark mode app:
  Background  #1D1D27   Card       #2A2A35
  Border      #3A3A47   Text       #DBDCD7

Status:
  Clock-in green  #30c24b
  Clock-out red   #ab0f12
  Location blue   #00BCD4
```

**Treat these as a starting point, not a constraint.** You are encouraged to refine the palette — add proper semantic status tokens (success/warning/error/info), interactive states (hover/pressed/disabled), and a wider neutral ramp. The cream/khaki/green earthy direction is part of the brand and should stay recognizable.

### 3.3 Tokens already defined

`src/constants/tokens.ts` includes:

- Spacing scale (4px base): `xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, xxxl 32`
- Font sizes: `small 12, caption 14, body 16, h3 18, h2 22, h1 28`
- Font weights: `400 / 500 / 600 / 700`
- Border radius: `sm 4, md 8, lg 12, xl 16, round 9999`
- Button heights: `sm 32, md 44, lg 52`
- 8-step shadow/elevation scale
- Animation durations: `instant / fast 150 / normal 250 / slow 400`

You may extend these but try not to invent parallel scales.

---

## 4. Surface 1 — Mobile app (employee-only after split)

### 4.1 Platform & shape

- React Native + Expo, iOS + Android
- Bottom tab navigation (currently 4 tabs, conditionally rendered)
- Light + dark mode required
- Push notifications via FCM
- Real-time data from Firestore — design must handle empty, loading, skeleton, and stale states

### 4.2 Screens to redesign (employee scope)

Drop everything admin. The employee mobile app keeps:

**Auth flow** (`src/screens/auth/`)

- `LoginPage` — email + password, "forgot password" path
- `SignUpPage` — registration + email verification

**Main tabs**

- **Today / Home** (NEW — does not exist in the current app) — the new landing screen after login. Should answer at a glance: _Am I clocked in? What's my next shift? What do I need to do today?_ Surfaces the active time entry, next upcoming event, any unread notifications, and quick actions (clock in, view today's checklist). This replaces Calendar as the default landing tab.
- **Calendar** (`src/screens/calendar/Calendar.tsx`) — month/week view of events, filter by label, tap into an event. No longer the landing tab.
- **Availability** (`src/screens/availability/AvailabilityPage.tsx`) — mark availability for upcoming shifts (feature-flagged per company)
- **Clock / Timesheet** (`src/screens/timesheet/TimeEntryScreen.tsx`) — large clock-in button, pause/resume, weekly summary, list of recent entries (feature-flagged per company)
- **Settings** (`src/screens/settings/Settings.tsx`) — profile, preferences, sign out, company switcher

**Detail screens**

- `EventDetails` — read-only event view: date/time, location with map, packages, attachments, workers list, notes, checklists
- `EventChecklists` — check off tasks for an event (workers can check, only admins can edit structure — but admins are gone from mobile, so this is check-only)
- `TimeEntryDetails` — view a past time entry, see status (pending/approved/denied)
- `ProfilePage` — edit name, profile picture, phone
- `UserPreferences` — calendar filter default, label visibility

**Special states**

- `SplashScreen` — first launch + cold start
- `LoadingScreen` — generic loading state

### 4.3 Mobile design priorities

- **Glanceable home.** The new Today / Home tab (see §4.2) is the default landing screen and must immediately answer: _Am I clocked in? What's my next shift? Anything I need to do?_ This is a new screen — design it from scratch. Calendar is no longer the entry point.
- **One-handed reach.** Primary actions (clock in/out, check task done) must be thumb-reachable. FABs and bottom sheets are good; tiny top-right buttons are not.
- **Status clarity.** Time entries have states (in progress, paused, submitted, approved, denied). Events have states (assigned, swapped, completed). Make these unmistakable at a glance.
- **Offline-friendly visuals.** The app talks to Firestore in real time but users are often in venues with bad signal. Design clearly for stale data, retry, and "you're offline" states.
- **Multi-company switcher.** A user may have 2–3 jobs in the app. The active-company selector is currently not surfaced well — design a clear, fast switcher (top bar? settings? long-press?).
- **Notification surfaces.** Push notifications drive a lot of behavior (new shift assigned, schedule changed, time entry approved). Consider an in-app inbox/feed of recent notifications.
- **Distinctive, not template-y.** The current UI looks like a generic Material/iOS app. Lean into the AntHill brand — the ant motif, the earthy palette, the calm/grounded feeling of "we handle the chaos so you can work."

---

## 5. Surface 2 — Admin web console (NEW)

### 5.1 Platform & shape

- **Greenfield web app.** Not built yet. You are designing it from scratch.
- Desktop-first, responsive down to tablet (1024px+). Mobile web is not a goal — managers use the mobile app for their own employee tasks, and the desktop for admin work.
- Likely Next.js or React + Vite, sharing the design tokens and brand with the mobile app. Final framework choice is open; design for the web idioms (multi-column layouts, modals, data tables, drag-and-drop, keyboard shortcuts).
- Same Firebase backend, same Firestore data — no API changes for this rework.
- Light + dark mode.

### 5.2 Screens to design (admin scope — currently in `src/screens/settings/admin/`)

Build these as proper desktop screens, not blown-up mobile views:

**Schedule management**

- **Calendar / scheduler** — admin view of the company calendar. Drag-and-drop to assign workers. Multi-week planning view. Filters by worker, label, package. Conflict detection (worker double-booked, unavailable, etc.).
- **Event editor** — create or edit an event. Currently a single long mobile form (`EventSubmit.tsx`); on web this can be a side panel or a multi-section dashboard with live preview of the worker schedule impact.
- **Event details (admin)** — same data as the employee view, but with edit affordances, worker assignment, and notes for workers.

**Employees**

- **Employee list** (`EmployeeList.tsx`) — table of all employees: name, role, hours worked this period, status. Bulk actions, invite by access code, role changes.
- **Employee detail** — drill-in: schedule history, hours worked, time entries, availability patterns.

**Payroll**

- **Payroll review** (`PayrollReview.tsx`) — the heaviest admin workflow. Table of time entries pending approval. Bulk approve/deny, edit times, export to PDF. Filter by employee, date range, status. Weekly/biweekly totals.
- **Payroll export** — PDF generation already exists in `exportService.ts`; design the export UI and the PDF itself.

**Company configuration**

- **Company preferences** (`CompanyPreferences.tsx`) — toggles for which features the company uses (`enableTimeSheet`, `enableAvailability`), work week start day, who can edit events, availability reminder settings.
- **Custom form builder** (`CompanyCustomForm.tsx`) — drag-to-build form fields (text, number, dropdown, checkbox, multiline) for two contexts: event forms and time-entry submission forms. This is dynamic schema work and deserves a proper builder UI on web.
- **Checklist library** (`ChecklistCreator.tsx`) — create reusable checklists that get attached to events.
- **Package library** (`PackageCreator.tsx`) — service packages assignable to events (think: "5-hour bartender package", "appetizer station").
- **Label library** (`LabelCreator.tsx`) — event categorization with color tags.

**Account / nav**

- **Top nav + sidebar** — workspace switcher (multi-company owners), notifications, profile menu
- **Sign-in** — separate from the mobile app's sign-in; this is the same Firebase Auth account but a web entry point

### 5.3 Web design priorities

- **Density without clutter.** Admin work involves a lot of data — workers, events, time entries, hours, totals. Use proper data tables, sticky headers, inline editing, keyboard navigation.
- **Drag-and-drop scheduling.** The single most valuable admin interaction. Assigning workers to events should feel like a real scheduling tool (think Notion, Linear, When I Work), not a form.
- **Bulk operations.** Approving 40 time entries one at a time is the current pain. Multi-select, bulk approve, bulk export.
- **Power-user shortcuts.** Cmd-K command palette, keyboard nav in tables, "press A to approve" on a focused row.
- **Live updates.** Firestore is real time; the UI should reflect changes from the mobile app instantly without manual refresh. Show subtle indicators when data updates.
- **Form builder as a first-class surface.** The custom-form feature is a differentiator. Design it like Typeform / Airtable, not like a settings page with text inputs.
- **No phone-think.** Tabs at the bottom, bottom sheets, FABs — none of these belong here. Use sidebars, modals, panels, popovers, hover states.

---

## 6. Shared design system

Both surfaces share:

- **Brand identity** — logo, ant motif, palette, type
- **Design tokens** — same scales for spacing, type, radius, shadow, animation
- **Color system** — same semantic tokens (success, warning, error, info, surface ramps) across mobile and web
- **Iconography** — one icon family
- **Voice & tone** — same microcopy register (calm, direct, lightly warm)

But each surface adapts:

- **Components** are platform-native — a mobile Button is not a web Button. Same name, same role, different implementation.
- **Layouts** are platform-native — bottom tabs on mobile, sidebar nav on web.
- **Interaction patterns** are platform-native — long-press on mobile, right-click on web; pull-to-refresh on mobile, live updates on web.

---

## 7. Deliverables

Please produce:

### 7.1 Design system foundation

- Refined color palette (extended from the existing AntHill palette) with full semantic tokens for both light and dark mode
- Type scale, spacing scale, radius scale, shadow scale (extending existing tokens)
- Updated logo / wordmark usage guidance (if applicable)
- Icon family selection (or custom set)
- Two reference Figma/HTML pages: one mobile, one web, showing the system applied

### 7.2 Mobile app

- Redesign of every screen listed in §4.2 in light and dark mode
- Native iOS and Android variants where they meaningfully differ (status bar, header, tab bar)
- Empty / loading / error / offline states for every data-driven screen
- Notification appearance (push payload preview + in-app notification list)
- Animation/transition notes for non-obvious cases (clock in, tab switch, list refresh)

### 7.3 Admin web console

- Information architecture: sitemap and primary navigation
- Wireframes for every screen in §5.2, then high-fidelity for the top 6 (calendar/scheduler, event editor, employee list, payroll review, custom form builder, company preferences)
- Light + dark mode
- Empty / loading / error states
- Responsive behavior down to 1024px (above that is target, below is graceful degradation)
- Interactive prototype of the scheduling drag-and-drop and the payroll bulk-approve flow

### 7.4 Hand-off artifacts

- Tokens exported in a format consumable by the existing `src/constants/tokens.ts` and a future web tokens file (JSON or CSS variables is fine)
- Component spec sheets for primitives (Button, Input, Card, Badge, Avatar, Table row, etc.) with states (default, hover, active, disabled, loading, error)
- Annotated screens for any non-obvious interactions

---

## 8. Constraints and non-goals

**In scope**

- Visual + interaction redesign of both surfaces
- Splitting admin out of mobile, into web
- Refining the existing brand palette and tokens
- Designing the admin web app from scratch

**Out of scope**

- Backend / data model changes — Firestore schema stays the same
- Adding new product features beyond what already exists (no new modules — just redesign what's there)
- iOS-only or Android-only premium features — keep parity
- Designing a customer-facing marketing site (anthillapp.com) — that's a separate project

**Hard constraints**

- React Native must remain the mobile framework (no rewrites to Flutter, native, etc.)
- Firebase must remain the backend
- Multi-company support is required on both surfaces
- Light + dark mode is required on both surfaces

---

## 9. Reference: key files to inspect for context

If you want to see how the current product is structured:

- Navigation graph: `src/navigation/AppNavigator.tsx`, `HomeTabs.tsx`, `SettingStack.tsx`
- Existing tokens: `src/constants/colors.ts`, `src/constants/tokens.ts`
- Existing UI primitives: `src/components/ui/`
- Role gating: `src/contexts/UserContext.tsx` (`isAdmin` derivation)
- Largest admin surface (gives a sense of the data volume): `src/screens/settings/admin/PayrollReview.tsx`
- Largest mobile surface: `src/screens/calendar/EventSubmit.tsx` (currently used by both roles — only the read-only path needs to survive in the employee app)
- Refactor notes already in the repo: `REFACTOR_PLAN.md`, `CODE_CONDENSING_STRATEGY.md`

---

## 10. Success criteria

The rework succeeds if:

1. An employee can open the mobile app at the start of a shift and clock in within 2 taps from cold start — the Today / Home tab makes the clock-in action available without leaving the landing screen.
2. A manager can approve a week of payroll on web in under 60 seconds.
3. A manager can drag a worker into an event slot and see conflicts resolved live.
4. Both surfaces feel like the _same product_ — anyone who uses both immediately recognizes the family.
5. The mobile app no longer contains any admin-only code paths.
6. A new feature can be added to either surface without inventing new design primitives.
