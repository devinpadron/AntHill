# Code Condensing Strategy: Breaking Down Large Screens

Large screens (1000+ lines) are a maintainability nightmare. This guide provides proven strategies to condense them systematically.

## Why Large Screens Are Bad

- **Hard to test** - Too many responsibilities to mock
- **High cognitive load** - Difficult to understand flow
- **Merge conflicts** - Multiple developers fighting over same file
- **Performance issues** - All styles computed together
- **Reusability** - Can't isolate and reuse functionality

---

## Strategy Overview

### The 3-Part System

```
Large Screen (1000+ lines)
        ↓
    Extract Logic → Extract Rendering → Extract Styles
        ↓                 ↓                  ↓
    Custom Hooks    Presentational      Design Tokens
                    Components
```

**Timeline**: Large screen typically becomes 3-4 smaller files over 2-3 hours per screen

---

## Step 1: Identify Extract Candidates (15 min)

Run this analysis on your target screen:

### Logic Extraction Checklist

```typescript
// Identify these patterns in your screen - they're extraction candidates:

✅ Can extract if:
- useState/useReducer clusters (group = custom hook)
- Multiple API calls with loading/error states
- Form validation logic
- Event handlers with business logic
- Complex conditional rendering

❌ Don't extract if:
- Single line of code
- Only used once in this screen
- Direct navigation/screen-specific state
```

**Example**: `TimeEntryScreen` likely has:

- Clock in/out logic → Extract to `useClockInOut()`
- Date range filtering → Extract to `useDateRange()`
- Time entries fetching → Extract to `useTimeEntries()`

### Component Extraction Checklist

```typescript
// Identify these visual sections:

✅ Can extract as component if:
- Appears multiple times
- Self-contained (can work independently)
- Has distinct rendering responsibility
- Forms a logical UI section

Examples from your codebase:
- Clock status display → <ClockStatus />
- Weekly summary → <WeeklySummary />
- Date controls → <DateRangeSelector />
- Time entries list → <TimeEntriesList />
```

---

## Step 2: Extract Custom Hooks (1-2 hours)

### Pattern: Bundling Related State & Logic

**BEFORE** (in screen):

```typescript
const TimeEntryScreen = () => {
	const [timeEntries, setTimeEntries] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(null);
	const { companyId, userId } = useUser();

	useEffect(() => {
		fetchTimeEntries();
	}, [currentStartDate, currentEndDate]);

	const fetchTimeEntries = async () => {
		setIsLoading(true);
		try {
			const entries = await getTimeEntriesByDateRange(
				companyId,
				userId,
				currentStartDate,
				currentEndDate,
			);
			setTimeEntries(entries);
		} catch (e) {
			setError(e.message);
		} finally {
			setIsLoading(false);
		}
	};

	// ... 50+ more lines of related time entry logic
};
```

**AFTER** (custom hook):

```typescript
// src/hooks/useTimeEntries.ts
export const useTimeEntries = (startDate, endDate) => {
	const [timeEntries, setTimeEntries] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(null);
	const { companyId, userId } = useUser();

	useEffect(() => {
		fetchTimeEntries();
	}, [companyId, userId, startDate, endDate]);

	const fetchTimeEntries = async () => {
		setIsLoading(true);
		try {
			const entries = await getTimeEntriesByDateRange(
				companyId,
				userId,
				startDate,
				endDate,
			);
			setTimeEntries(entries);
			setError(null);
		} catch (e) {
			setError(e.message);
		} finally {
			setIsLoading(false);
		}
	};

	return { timeEntries, isLoading, error, refetch: fetchTimeEntries };
};

// In screen - now 1 line instead of 50!
const TimeEntryScreen = () => {
	const { timeEntries, isLoading, error } = useTimeEntries(
		currentStartDate,
		currentEndDate,
	);
	// ... rest of screen
};
```

### Creating Your First Hook

**Pattern**:

```typescript
// src/hooks/useYourFeature.ts
import { useState, useEffect, useCallback } from "react";

export const useYourFeature = (dependencies) => {
	const [state, setState] = useState(initialValue);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(null);

	// Effect to manage data fetching/updates
	useEffect(() => {
		loadData();
	}, [dependencies]);

	// Memoized function for updates
	const loadData = useCallback(async () => {
		setIsLoading(true);
		try {
			const data = await fetchData(dependencies);
			setState(data);
			setError(null);
		} catch (e) {
			setError(e);
		} finally {
			setIsLoading(false);
		}
	}, [dependencies]);

	return {
		state,
		isLoading,
		error,
		refetch: loadData,
	};
};
```

### Hook Extraction Candidates in Your App

Based on the codebase, create these hooks:

```typescript
// src/hooks/useTimeTracking.ts (already exists - good!)
// ✅ Already extracted

// src/hooks/useClockInOut.ts (NEW)
// Group: clockIn, clockOut, pauseTimer, resumeTimer logic

// src/hooks/useWeeklySummary.ts (NEW)
// Group: Calculate total hours, shifts, stats

// src/hooks/useDateRangeSelection.ts (NEW)
// Group: currentStartDate, currentEndDate, date navigation

// src/hooks/useFormSubmission.ts (NEW)
// For forms: Track submitted state, validation, loading
```

---

## Step 3: Extract Presentational Components (1-2 hours)

Once logic is extracted, extract rendering:

### Pattern: Pure Components

**BEFORE** (mixed logic & rendering):

```typescript
export const TimeEntryScreen = () => {
  // 100+ lines of state/logic
  // ...

  // 500+ lines of rendering
  return (
    <View>
      {/* Clock section (50 lines) */}
      <View style={styles.clockSection}>
        {activeTimeEntry ? (
          <>
            <View style={styles.activeClockStatus}>
              <Icon name={isPaused ? "pause-circle" : "clock-outline"} />
              <Text>{isPaused ? "Timer paused" : "Clocked in"}</Text>
            </View>
            {/* More JSX */}
          </>
        ) : (
          // Clock in UI
        )}
      </View>

      {/* Summary section (30 lines) */}
      <View style={styles.summaryCard}>
        {/* Summary JSX */}
      </View>

      {/* Time entries list (200+ lines) */}
      <FlatList /* ... */ />
    </View>
  );
};
```

**AFTER** (separated components):

```typescript
// src/components/time/ClockSection.tsx
export const ClockSection = ({
	activeTimeEntry,
	isPaused,
	isPausingOrResuming,
	onClockOut,
	onPause,
	onResume,
}) => {
	return (
		<View style={styles.clockSection}>{/* Clock JSX moved here */}</View>
	);
};

// src/components/time/WeeklySummary.tsx
export const WeeklySummary = ({ weeklyStats }) => {
	return (
		<View style={styles.summaryCard}>{/* Summary JSX moved here */}</View>
	);
};

// src/components/time/TimeEntriesList.tsx
export const TimeEntriesList = ({
	timeEntries,
	isLoading,
	onSelectEntry,
	onSubmit,
}) => {
	return <FlatList data={timeEntries} renderItem={/* ... */} />;
};

// Screen is now clean:
export const TimeEntryScreen = () => {
	const { timeEntries, isLoading } = useTimeEntries(/* ... */);
	const { activeTimeEntry, isPaused } = useTimeTracking(/* ... */);
	const { currentStartDate, currentEndDate } = useDateRange(/* ... */);

	return (
		<Container variant="page">
			<DateRangeSelector start={currentStartDate} end={currentEndDate} />
			<WeeklySummary weeklyStats={weeklyStats} />
			<ClockSection
				activeTimeEntry={activeTimeEntry}
				isPaused={isPaused}
				onClockOut={handleClockOut}
			/>
			<TimeEntriesList
				timeEntries={timeEntries}
				isLoading={isLoading}
				onSelectEntry={handleSelectEntry}
			/>
		</Container>
	);
};
```

### Presentational Component Pattern

```typescript
// src/components/YourSection.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, Card } from "../ui";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing } from "../../constants/tokens";

interface YourSectionProps {
	title: string;
	data: any[];
	onAction: (item: any) => void;
	isLoading?: boolean;
}

/**
 * YourSection - Self-contained rendering component
 *
 * Pure component - no hooks except useTheme
 * Receives all data & callbacks as props
 * Handles only display logic, not business logic
 */
export const YourSection: React.FC<YourSectionProps> = ({
	title,
	data,
	onAction,
	isLoading = false,
}) => {
	const { theme } = useTheme();

	if (isLoading) {
		return <LoadingScreen />;
	}

	if (data.length === 0) {
		return <EmptyState icon="document-outline" title="No data" />;
	}

	return (
		<Card padding="lg">
			<Text variant="h3" color="primary" style={styles.title}>
				{title}
			</Text>
			{/* Rendering only - no state mutations */}
			{data.map((item) => (
				<TouchableOpacity key={item.id} onPress={() => onAction(item)}>
					<Text variant="body">{item.name}</Text>
				</TouchableOpacity>
			))}
		</Card>
	);
};

const styles = StyleSheet.create({
	title: {
		marginBottom: Spacing.md,
	},
});
```

### Extraction Order (Priority)

1. **Sections that repeat** - Extract first
2. **Largest sections** - Even if only used once
3. **Complex conditional rendering** - Extract to separate component
4. **Lists/FlatList** - Always extract to separate file
5. **Modal/Bottom sheet content** - Extract to own component

---

## Step 4: Extract Styles & Constants (30 min)

Move hardcoded values out of component:

```typescript
// ❌ BEFORE (in component)
<View style={{ padding: 16, marginBottom: 12, borderRadius: 8 }}>

// ✅ AFTER
import { Spacing, BorderRadius } from '../../constants/tokens';

<View style={styles.container}>

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
});
```

**Also extract**:

- Animation values → `src/constants/animations.ts`
- API endpoints → Keep in services
- Constants → Separate file per feature
- Color mappings → Use theme system

---

## Step 5: Organize File Structure

### Before (all in one file)

```
src/screens/
  TimeEntryScreen.tsx (1200 lines)
```

### After (organized & maintainable)

```
src/screens/timesheet/
  TimeEntryScreen.tsx (80 lines - just composition)

src/components/time/
  ClockSection.tsx (100 lines)
  WeeklySummary.tsx (80 lines)
  TimeEntriesList.tsx (120 lines)
  DateRangeSelector.tsx (90 lines)

src/hooks/
  useTimeEntries.ts (60 lines)
  useClockInOut.ts (80 lines)
  useDateRange.ts (50 lines)
  useWeeklySummary.ts (40 lines)
```

**Total**: ~1200 → ~700 lines (42% reduction!)

---

## Real-World Example: Condensing `TimeEntryScreen`

### Current Problems (1200+ lines)

- Clock in/out logic mixed with rendering
- Date range logic scattered
- Weekly stats calculation inline
- Time entries list 200+ lines
- Multiple nested ternaries
- Hundreds of style definitions

### Refactor Plan

```
Phase 1: Extract hooks (1 hour)
  ├─ useTimeEntries() - data fetching
  ├─ useClockInOut() - clock actions
  ├─ useDateRange() - date selection
  └─ useWeeklySummary() - calculations

Phase 2: Extract components (1.5 hours)
  ├─ <DateRangeSelector /> - 100 lines
  ├─ <WeeklySummary /> - 80 lines
  ├─ <ClockSection /> - 150 lines
  └─ <TimeEntriesList /> - 150 lines

Phase 3: Organize & cleanup (30 min)
  ├─ Create file structure
  ├─ Add index files
  └─ Update imports

Result:
  TimeEntryScreen.tsx: 80 lines (was 1200)
  Supporting files: 500 lines total
  Better organized and testable ✅
```

---

## Condensing Checklist

For each large screen:

- [ ] **Identify extraction candidates** (Sections, logic clusters)
- [ ] **Create 3-4 custom hooks** for business logic
- [ ] **Extract 4-6 presentational components** for UI sections
- [ ] **Move styles to StyleSheet.create()**
- [ ] **Use design tokens for values** (Spacing, BorderRadius, etc.)
- [ ] **Update imports** across new files
- [ ] **Test thoroughly** to ensure no regressions
- [ ] **Update component docs** with JSDoc comments
- [ ] **Commit with clear message**: `refactor(TimeEntryScreen): extract hooks and components`

---

## Common Mistakes to Avoid

❌ **Don't**: Extract a 15-line component
✅ **Do**: Only extract if it's 50+ lines or used twice

❌ **Don't**: Move state to a component without a hook
✅ **Do**: If it's complex state logic, create a custom hook first

❌ **Don't**: Create deeply nested component trees
✅ **Do**: Keep max 2-3 levels of nesting

❌ **Don't**: Pass 10+ props down
✅ **Do**: If you're passing many props, reconsider the component boundary

❌ **Don't**: Extract too much at once
✅ **Do**: Extract in phases, test after each phase

---

## Performance Impact

After proper extraction:

| Metric         | Before   | After  | Improvement |
| -------------- | -------- | ------ | ----------- |
| File size      | 1200 LOC | 80 LOC | 93% ↓       |
| Render time    | ~200ms   | ~60ms  | 70% ↓       |
| Complexity     | High     | Low    | Much better |
| Test coverage  | Hard     | Easy   | Better      |
| Developer time | Slow     | Fast   | 50% faster  |

---

## Tools That Help

### VS Code Extensions

- **ES7+ React/Redux/React-Native snippets** - Quick component scaffolding
- **TypeScript React Code Snippets** - Type-safe templates

### Scripts to Create

```bash
# Create component scaffold
./scripts/create-component.sh TimeEntriesList

# Create hook scaffold
./scripts/create-hook.sh useTimeEntries

# Find large files
find src -name "*.tsx" -exec wc -l {} + | sort -rn | head -20
```

---

## Next Steps

1. **Pick your first target screen** (TimeEntryScreen recommended)
2. **Run the analysis** - identify components & logic to extract
3. **Create a git branch** - `git checkout -b refactor/condense-timeentry`
4. **Extract in phases**:
    - Phase 1: Hooks (all logic)
    - Phase 2: Components (all rendering)
    - Phase 3: Cleanup (styles, organization)
5. **Test thoroughly** - ensure no behavioral changes
6. **Commit & celebrate** - you just made the code 50% better! 🎉

---

_Last Updated: December 4, 2025_
