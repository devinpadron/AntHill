# AntHill Refactor & Facelift Plan

## Executive Summary

AntHill has a solid foundation with a theme system, UI component library, and design tokens already in place. This plan focuses on **consolidating**, **modernizing**, and **polishing** rather than rebuilding from scratch.

---

## Phase 1: Foundation Audit (2-3 days)

### 1.1 Identify Inconsistencies

**Goal**: Find areas not using the UI component library

**Action Items**:

- [ ] Search for hardcoded colors (`#` in styles)
- [ ] Find raw `<Text>`, `<View>`, `<TouchableOpacity>` usage
- [ ] List screens using custom styling instead of UI components
- [ ] Document theme color usage patterns

**Quick Check Commands**:

```bash
# Find hardcoded colors
grep -r "backgroundColor.*#" src/screens --include="*.tsx"
grep -r "color.*#" src/screens --include="*.tsx"

# Find raw React Native components
grep -r "from 'react-native'" src/screens --include="*.tsx" | grep -v "StyleSheet\|Platform\|Dimensions"
```

### 1.2 Theme System Enhancement

**Current**: Theme works but may need expansion

**Action Items**:

- [ ] Add missing semantic color tokens (if any)
- [ ] Verify all screens use `useTheme()` hook
- [ ] Add elevation/shadow tokens to design system
- [ ] Document theme usage in README

**Example Enhancement**:

```typescript
// src/constants/colors.ts - Add semantic tokens
export const AntHill_Light = {
	...existing,

	// Status colors
	Success: "#4CAF50",
	Warning: "#FF9800",
	Error: "#F44336",
	Info: "#2196F3",

	// Interactive states
	Hover: "#E0E0E0",
	Pressed: "#BDBDBD",
	Disabled: "#F5F5F5",

	// Borders
	BorderLight: "#E0E0E0",
	BorderMedium: "#BDBDBD",
	BorderDark: "#9E9E9E",
};
```

---

## Phase 2: Component Library Completion (3-4 days)

### 2.1 Missing Components to Build

Based on the codebase, create these reusable components:

**Priority 1 (Commonly Used)**:

- [ ] **LoadingScreen** - Centralized loading states
- [ ] **EmptyState** - For "no data" scenarios
- [ ] **ErrorBoundary** - Graceful error handling
- [ ] **ConfirmDialog** - Standardized alerts/confirms
- [ ] **BottomSheet** - Wrapper for consistent sheet styling
- [ ] **StatusBadge** - For time entry/event statuses

**Priority 2 (Quality of Life)**:

- [ ] **FormField** - Wrapper combining label, input, error
- [ ] **Section** - Screen section with title/subtitle
- [ ] **DividerLine** - Styled divider
- [ ] **FloatingActionButton** - Consistent FAB styling
- [ ] **TabBar** - Custom tab bar component

**Example Component Template**:

```tsx
// src/components/ui/EmptyState.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { Button } from "./Button";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing } from "../../constants/tokens";

interface EmptyStateProps {
	icon?: keyof typeof Ionicons.glyphMap;
	title: string;
	message?: string;
	actionLabel?: string;
	onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
	icon = "document-outline",
	title,
	message,
	actionLabel,
	onAction,
}) => {
	const { theme } = useTheme();

	return (
		<View style={styles.container}>
			<Ionicons name={icon} size={64} color={theme.TertiaryText} />
			<Text variant="h3" color="primary" style={styles.title}>
				{title}
			</Text>
			{message && (
				<Text
					variant="body"
					color="secondary"
					align="center"
					style={styles.message}
				>
					{message}
				</Text>
			)}
			{actionLabel && onAction && (
				<Button
					variant="primary"
					onPress={onAction}
					style={styles.button}
				>
					{actionLabel}
				</Button>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: Spacing.xl,
	},
	title: {
		marginTop: Spacing.lg,
	},
	message: {
		marginTop: Spacing.sm,
		maxWidth: 300,
	},
	button: {
		marginTop: Spacing.lg,
	},
});
```

### 2.2 Enhance Existing Components

**Current components that need polish**:

- [ ] **Button** - Add haptic feedback, ripple effect (Android)
- [ ] **Card** - Add more elevation variants
- [ ] **Text** - Add `numberOfLines` truncation support
- [ ] **Avatar** - Add loading state placeholder
- [ ] **SearchBar** - Add debounced onChange

---

## Phase 3: Screen-by-Screen Refactor (1-2 weeks)

### 3.1 Prioritization Matrix

| Screen           | Complexity | User Impact | Priority |
| ---------------- | ---------- | ----------- | -------- |
| TimeEntryScreen  | High       | Critical    | 1        |
| CalendarScreen   | High       | Critical    | 2        |
| TimeEntryDetails | Medium     | High        | 3        |
| EventDetails     | Medium     | High        | 4        |
| Settings screens | Low-Med    | Medium      | 5        |
| Admin screens    | Medium     | Low         | 6        |

### 3.2 Refactor Pattern for Each Screen

**Step-by-step process**:

1. **Create backup**: Git commit current state
2. **Audit imports**: Replace raw RN components with UI library
3. **Theme colors**: Replace hardcoded colors with theme
4. **Extract components**: Break down large components
5. **Add error states**: Use EmptyState, loading indicators
6. **Test thoroughly**: Ensure functionality preserved

**Example Refactor** (TimeEntryScreen):

```tsx
// BEFORE: Hardcoded styles
<View style={{ backgroundColor: "#f7f7f7", padding: 16 }}>
	<Text style={{ fontSize: 16, fontWeight: "600" }}>Summary</Text>
</View>;

// AFTER: Theme-aware UI components
import { Container } from "../../components/ui/Container";
import { Text } from "../../components/ui/Text";

<Container variant="card" padding="lg">
	<Text variant="h3" color="primary">
		Summary
	</Text>
</Container>;
```

### 3.3 Custom Form System Refactor

**Current Issues**:

- `CustomFormRender.tsx` has inline styles
- `TimeEntrySubmitModal.tsx` is complex
- Form validation logic scattered

**Refactor Plan**:

- [ ] Create `FormField` wrapper component
- [ ] Extract validation to `src/utils/formValidation.ts`
- [ ] Create field type components (`TextField`, `ChecklistField`, etc.)
- [ ] Centralize error display

---

## Phase 4: Visual Facelift (1 week)

### 4.1 Modern UI Patterns to Implement

**Cards & Elevation**:

- Add subtle shadows (already have `elevation` prop)
- Increase border radius for softer look (8px → 12px)
- Add hover/press states with opacity/scale

**Typography**:

- Verify font weights are consistent
- Add line-height for better readability
- Use `Text` component everywhere

**Spacing**:

- Use design tokens (`Spacing.md`, etc.) consistently
- Add more whitespace between sections
- Standardize screen padding

**Colors**:

- Review color contrast ratios (WCAG AA)
- Add subtle background gradients (optional)
- Ensure status colors are distinguishable

### 4.2 Animation & Transitions

Add polish with React Native Reanimated:

**Candidates for Animation**:

- [ ] Button press feedback
- [ ] Card entry/exit transitions
- [ ] Modal slide-up/down
- [ ] List item animations
- [ ] Tab transitions
- [ ] Loading skeleton screens

**Example - Button Press Animation**:

```tsx
import Animated, {
	useAnimatedStyle,
	withSpring,
} from "react-native-reanimated";

const animatedStyle = useAnimatedStyle(() => ({
	transform: [{ scale: withSpring(pressed ? 0.95 : 1) }],
}));
```

### 4.3 Iconography Audit

**Current**: Using `@expo/vector-icons` (Ionicons)

**Actions**:

- [ ] Review all icon usage for consistency
- [ ] Create icon size constants (16, 20, 24, 32)
- [ ] Ensure icons match action semantics
- [ ] Add icon + label pattern for clarity

---

## Phase 5: Performance Optimization (3-4 days)

### 5.1 React Performance

**Common Issues to Fix**:

- [ ] Memoize expensive components with `React.memo`
- [ ] Use `useCallback` for callbacks passed to children
- [ ] Use `useMemo` for expensive calculations
- [ ] Lazy load screens with `React.lazy`

**Example**:

```tsx
// Before
const TimeEntryCard = ({ timeEntry, onPress }) => { ... }

// After
const TimeEntryCard = React.memo(({ timeEntry, onPress }) => { ... });
```

### 5.2 List Performance

**FlatList Optimizations**:

- [ ] Add `keyExtractor`
- [ ] Set `maxToRenderPerBatch`
- [ ] Use `windowSize` for long lists
- [ ] Implement `getItemLayout` if fixed heights

### 5.3 Image Optimization

- [ ] Use `expo-image` instead of `Image`
- [ ] Add placeholder/blurhash
- [ ] Implement image caching
- [ ] Lazy load images below fold

---

## Phase 6: Testing & Documentation (Ongoing)

### 6.1 Testing Strategy

**Unit Tests**:

- [ ] Test UI components in isolation
- [ ] Test utilities and helpers
- [ ] Test validation logic

**Integration Tests**:

- [ ] Test user flows (clock in/out)
- [ ] Test form submissions
- [ ] Test navigation

**Visual Regression**:

- [ ] Set up Chromatic or Percy
- [ ] Screenshot key screens in light/dark mode

### 6.2 Documentation

**Update/Create**:

- [ ] `README.md` - Setup and architecture overview
- [ ] `CONTRIBUTING.md` - Development guidelines
- [ ] `STYLE_GUIDE.md` - UI component usage examples
- [ ] Component storybook (optional but recommended)

---

## Quick Wins (Do These First!)

These give immediate visual impact with minimal effort:

### 1. Standardize Border Radius (30 min)

```typescript
// src/constants/tokens.ts
export const BorderRadius = {
	sm: 4,
	md: 8,
	lg: 12,
	xl: 16,
	full: 9999,
} as const;
```

Then replace all `borderRadius: 8` with `BorderRadius.lg`

### 2. Add Loading States (1 hour)

Create `LoadingScreen` component and use it everywhere instead of inline ActivityIndicators

### 3. Consistent Spacing (2 hours)

Replace all inline padding/margin numbers with `Spacing` tokens

### 4. Empty States (2 hours)

Add `EmptyState` component to all lists that can be empty

### 5. Error Boundaries (1 hour)

Wrap major screen sections in error boundaries for graceful failures

---

## Implementation Timeline

| Phase                | Duration  | Dependencies |
| -------------------- | --------- | ------------ |
| Phase 1: Audit       | 2-3 days  | None         |
| Phase 2: Components  | 3-4 days  | Phase 1      |
| Phase 3: Screens     | 1-2 weeks | Phase 2      |
| Phase 4: Facelift    | 1 week    | Phase 3      |
| Phase 5: Performance | 3-4 days  | Phase 3      |
| Phase 6: Testing     | Ongoing   | All phases   |

**Total Estimated Time**: 4-5 weeks for complete refactor

---

## Success Metrics

Track these to measure improvement:

- [ ] **Code Quality**: Reduce duplicate code by 30%
- [ ] **Consistency**: 90%+ screens use UI library
- [ ] **Performance**: Reduce re-renders by 40%
- [ ] **Accessibility**: WCAG AA contrast ratios
- [ ] **Bundle Size**: Keep under current size
- [ ] **Developer Experience**: Faster feature development

---

## Tools & Resources

**Recommended Tools**:

- **Storybook** - Component library documentation
- **React Native Debugger** - Performance profiling
- **Flipper** - Network/layout debugging
- **Why Did You Render** - Performance optimization

**Design Inspiration**:

- Linear (task management)
- Notion (content organization)
- Superhuman (email, great interactions)
- Stripe Dashboard (clean data display)

---

## Next Steps

1. **Review this plan** with team
2. **Create GitHub Project** with tasks from each phase
3. **Start with Quick Wins** to build momentum
4. **Tackle Phase 1 audit** to understand scope
5. **Iterate and adjust** timeline as needed

---

_Generated: December 4, 2025_
_Last Updated: December 4, 2025_
