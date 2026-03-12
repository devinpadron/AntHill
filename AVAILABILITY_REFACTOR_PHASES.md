# AvailabilityPage Refactor — Phases 2 & 3

## Phase 2: Extract Presentational Components (5 components, ~600 lines out)

### 1. `AvailabilityTabBar` — extract the tab bar + animated indicator

**Lines**: 40–72 (`TabIndicator`) + 597–660 (tab JSX)

Already has `TabIndicator` as a separate function — promote to its own file alongside the tab bar. Use theme colors instead of hardcoded `#4A90E2`, `#6B7280`.

**File**: `src/components/availability/AvailabilityTabBar.tsx`

### 2. `AvailabilityEventCard` — replace inline `renderEventCard`

**Lines**: 259–443 (~180 lines)

**Note**: `src/components/availability/EventCard.tsx` and `src/components/availability/EventActionButtons.tsx` already exist but are **not being used** by AvailabilityPage. Reconcile/update `EventCard` to handle all 3 tabs (unconfirmed/confirmed/declined) and integrate `EventActionButtons`. Use existing UI components:

- `StatusBadge` instead of manual badge rendering
- `Button` instead of raw `TouchableOpacity` for confirm/decline/undecline
- `DetailCard` instead of raw `Animated.View`
- Theme colors via `useTheme()` instead of hardcoded hex values

**File**: Update existing `src/components/availability/EventCard.tsx`

### 3. `ReminderSettingsModal` — the entire reminder modal

**Lines**: 676–813 (~140 lines)

Replace raw components with:

- `ToggleSwitch` (already exists in UI library) instead of raw `Switch`
- `FormInput` instead of raw `TextInput`
- `Button` instead of raw `TouchableOpacity` for Cancel/Save
- `Text` (themed) instead of raw RN `Text`

**File**: `src/components/availability/ReminderSettingsModal.tsx`

### 4. `AdminWorkerModal` — the admin event details modal

**Lines**: 814–1148 (~330 lines — the single largest block)

This modal contains 3 copy-pasted worker sections. Extract a shared sub-component:

### 5. `WorkerSection` — reusable for confirmed/unconfirmed/declined lists

**Pattern repeated 3 times** (lines 870–950, 950–1030, 1030–1115)

```tsx
<WorkerSection
	title="Confirmed"
	icon="checkmark-circle"
	iconColor="#4ADE80"
	workers={eventWorkerDetails.confirmed}
	actions={[{ label: "Decline", status: "declined", variant: "destructive" }]}
	onStatusChange={handleAdminStatusChange}
	emptyText="No confirmed workers"
/>
```

This alone eliminates ~100 lines of duplication.

**Files**:

- `src/components/availability/AdminWorkerModal.tsx`
- `src/components/availability/WorkerSection.tsx`

---

## Phase 3: Theme & Style Cleanup (~570 lines of styles → ~200)

### Current problems

- 33% of the file is `StyleSheet` definitions
- All colors hardcoded (`#F9FAFB`, `#4A90E2`, `#EF4444`, `#1F2937`, etc.)
- No design tokens used for spacing, border radius, font sizes

### Actions

1. **Each extracted component takes its own styles** — eliminates sharing a monolithic `StyleSheet`
2. **Replace hardcoded colors** with `theme.*` values (e.g., `#F9FAFB` → `theme.Background`, `#4A90E2` → `theme.LocationBlue`)
3. **Use design tokens**: `Spacing.lg` instead of `16`, `BorderRadius.lg` instead of `12`
4. **Use existing UI components** to eliminate style definitions entirely:
    - `EmptyState` replaces `renderEmptyState` + 4 empty-state styles
    - `LoadingScreen` replaces inline `ActivityIndicator` + 2 loading styles
    - `StatusBadge` replaces 3 badge styles
    - `Button` replaces 6 button styles (confirm, decline, undecline, cancel, save, close)
    - `AppHeader` replaces header + title styles

### Projected Result

| File                      | Before    | After    | Notes                        |
| ------------------------- | --------- | -------- | ---------------------------- |
| **AvailabilityPage.tsx**  | 1,436     | **~80**  | Just composition + hooks     |
| AvailabilityTabBar.tsx    | —         | ~90      | Tab bar + animated indicator |
| EventCard.tsx (updated)   | 50        | ~100     | Handles all 3 tabs           |
| ReminderSettingsModal.tsx | —         | ~100     | Uses UI library components   |
| AdminWorkerModal.tsx      | —         | ~80      | Composed from WorkerSection  |
| WorkerSection.tsx         | —         | ~60      | Reusable worker list section |
| **Total**                 | **1,436** | **~510** | **~65% reduction**           |

### Implementation Order

```
1. Extract modals (self-contained, easy to test)
   └─ WorkerSection → AdminWorkerModal → ReminderSettingsModal

2. Extract tab bar + update EventCard (visual components)
   └─ AvailabilityTabBar → reconcile EventCard + EventActionButtons

3. Theme & cleanup pass
   └─ Replace hardcoded colors → use design tokens → use UI library
```

Each phase should be committed separately. Test after each extraction to ensure no regressions.
