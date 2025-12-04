# Quick Start: Refactoring AntHill Screens

This guide helps you quickly refactor existing screens to use the UI component library.

## Step-by-Step Refactor Checklist

### ✅ Before You Start

- [ ] Create a new git branch: `git checkout -b refactor/screen-name`
- [ ] Run the app to confirm current behavior
- [ ] Take screenshots for visual comparison

### 1. Update Imports (2 min)

**Replace raw React Native imports:**

```tsx
// ❌ BEFORE
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

// ✅ AFTER
import { StyleSheet, View } from "react-native";
import { Text, Button, Card, Container } from "../../components/ui";
import { useTheme } from "../../contexts/ThemeContext";
```

### 2. Add Theme Hook (30 sec)

```tsx
const YourScreen = () => {
	const { theme } = useTheme();

	// ... rest of component
};
```

### 3. Replace Components (5-10 min)

#### Text Components

```tsx
// ❌ BEFORE
<Text style={{ fontSize: 18, fontWeight: '600', color: '#333' }}>
  Hello World
</Text>

// ✅ AFTER
<Text variant="h3" color="primary">
  Hello World
</Text>
```

**Available Text variants**: `h1`, `h2`, `h3`, `body`, `caption`, `small`  
**Available colors**: `primary`, `secondary`, `tertiary`, `white`, `black`, `error`, `success`, `info`

#### Buttons

```tsx
// ❌ BEFORE
<TouchableOpacity
  style={{ backgroundColor: '#007AFF', padding: 12, borderRadius: 8 }}
  onPress={handlePress}
>
  <Text style={{ color: 'white' }}>Save</Text>
</TouchableOpacity>

// ✅ AFTER
<Button
  variant="primary"
  title="Save"
  onPress={handlePress}
/>
```

**Button variants**: `primary`, `secondary`, `outline`, `text`, `destructive`  
**Button sizes**: `small`, `medium`, `large`

#### Containers & Cards

```tsx
// ❌ BEFORE
<View style={{
  backgroundColor: 'white',
  padding: 16,
  borderRadius: 8,
  shadowColor: '#000',
  shadowOpacity: 0.1,
}}>
  {children}
</View>

// ✅ AFTER
<Card padding="lg">
  {children}
</Card>

// OR for page-level containers
<Container variant="page" padding="lg">
  {children}
</Container>
```

#### Loading States

```tsx
// ❌ BEFORE
{
	isLoading && (
		<View
			style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
		>
			<ActivityIndicator size="large" />
			<Text style={{ marginTop: 10 }}>Loading...</Text>
		</View>
	);
}

// ✅ AFTER
{
	isLoading && <LoadingScreen message="Loading events..." />;
}
```

#### Empty States

```tsx
// ❌ BEFORE
{
	items.length === 0 && (
		<View style={styles.empty}>
			<Text>No items found</Text>
		</View>
	);
}

// ✅ AFTER
{
	items.length === 0 && (
		<EmptyState
			icon="calendar-outline"
			title="No events found"
			message="Create your first event to get started"
			actionLabel="Create Event"
			onAction={() => navigation.navigate("CreateEvent")}
		/>
	);
}
```

### 4. Replace Hardcoded Colors (10 min)

**Find all color values:**

```bash
# In your screen file
grep -n "#[0-9A-Fa-f]" src/screens/YourScreen.tsx
```

**Replace with theme colors:**

```tsx
// ❌ BEFORE
<View style={{ backgroundColor: '#FFFFFF' }}>
  <Text style={{ color: '#333333' }}>Title</Text>
  <Text style={{ color: '#666666' }}>Subtitle</Text>
</View>

// ✅ AFTER
<View style={{ backgroundColor: theme.CardBackground }}>
  <Text color="primary">Title</Text>
  <Text color="secondary">Subtitle</Text>
</View>
```

**Common theme colors:**

- `theme.Background` - Page background
- `theme.CardBackground` - Card/modal background
- `theme.PrimaryText` - Main text
- `theme.SecondaryText` - Subtitle text
- `theme.TertiaryText` - Disabled/placeholder text
- `theme.LocationBlue` - Primary action color
- `theme.NotificationGreen` - Success states
- `theme.DateBadge` - Badge backgrounds

### 5. Use Design Tokens (5 min)

```tsx
import { Spacing, FontSize, BorderRadius } from "../../constants/tokens";

// ❌ BEFORE
const styles = StyleSheet.create({
	container: {
		padding: 16,
		borderRadius: 8,
	},
	title: {
		fontSize: 18,
		marginBottom: 12,
	},
});

// ✅ AFTER
const styles = StyleSheet.create({
	container: {
		padding: Spacing.lg,
		borderRadius: BorderRadius.lg,
	},
	title: {
		fontSize: FontSize.h3,
		marginBottom: Spacing.md,
	},
});
```

### 6. Test & Verify (5 min)

- [ ] Visual comparison with screenshots
- [ ] Test light/dark theme toggle
- [ ] Test all interactive elements
- [ ] Check on iOS and Android (if possible)
- [ ] Verify no console errors/warnings

### 7. Cleanup (2 min)

- [ ] Remove unused style objects
- [ ] Remove unused imports
- [ ] Run `npm run format` (Prettier)
- [ ] Commit changes with clear message

```bash
git add .
git commit -m "refactor(YourScreen): migrate to UI component library"
```

---

## Common Patterns

### Pattern 1: Screen Layout

```tsx
import { Container, Text, Card } from "../../components/ui";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing } from "../../constants/tokens";

const MyScreen = () => {
	const { theme } = useTheme();

	return (
		<Container variant="page" padding="lg">
			<Text
				variant="h2"
				color="primary"
				style={{ marginBottom: Spacing.lg }}
			>
				Screen Title
			</Text>

			<Card padding="lg">{/* Card content */}</Card>
		</Container>
	);
};
```

### Pattern 2: List with Empty/Loading States

```tsx
import { LoadingScreen, EmptyState } from "../../components/ui";

const MyListScreen = () => {
	const [items, setItems] = useState([]);
	const [isLoading, setIsLoading] = useState(true);

	if (isLoading) {
		return <LoadingScreen message="Loading items..." />;
	}

	if (items.length === 0) {
		return (
			<EmptyState
				icon="document-outline"
				title="No items yet"
				message="Get started by creating your first item"
				actionLabel="Create Item"
				onAction={handleCreate}
			/>
		);
	}

	return (
		<FlatList
			data={items}
			renderItem={renderItem}
			keyExtractor={(item) => item.id}
		/>
	);
};
```

### Pattern 3: Form Fields

```tsx
import { Text, Button, Card } from "../../components/ui";
import { Spacing } from "../../constants/tokens";

const MyForm = () => {
	const { theme } = useTheme();

	return (
		<Card padding="lg">
			<Text
				variant="body"
				color="primary"
				style={{ marginBottom: Spacing.sm }}
			>
				Field Label
			</Text>
			<TextInput
				style={{
					borderWidth: 1,
					borderColor: theme.DateBadge,
					borderRadius: BorderRadius.md,
					padding: Spacing.md,
					color: theme.PrimaryText,
				}}
				placeholderTextColor={theme.TertiaryText}
				placeholder="Enter value"
			/>

			<Button
				variant="primary"
				title="Submit"
				onPress={handleSubmit}
				style={{ marginTop: Spacing.lg }}
			/>
		</Card>
	);
};
```

---

## Pro Tips

### 🎨 Theme Colors

Always use `theme.X` instead of hardcoded hex values. This ensures dark mode works automatically.

### 📏 Spacing

Use `Spacing` tokens (`xs`, `sm`, `md`, `lg`, `xl`, `xxl`, `xxxl`) for all margins and padding.

### 🔤 Typography

Use `Text` component variants instead of custom font sizes. This ensures consistency.

### 🎯 Icons

Always use the same icon library (Ionicons) and consistent sizes (16, 20, 24).

### ⚡ Performance

Wrap style objects in `useMemo` if they depend on theme:

```tsx
const containerStyle = useMemo(
	() => ({
		backgroundColor: theme.CardBackground,
		borderColor: theme.DateBadge,
	}),
	[theme],
);
```

---

## Need Help?

**Common Issues:**

1. **"Component looks different"** → Check if you're using the correct variant/size
2. **"Colors are wrong"** → Ensure you added `useTheme()` hook
3. **"Type errors"** → Check the component props interface in the component file
4. **"Dark mode broken"** → You probably have hardcoded colors somewhere

**Resources:**

- See `src/components/ui/` for component implementations
- Check `REFACTOR_PLAN.md` for overall strategy
- Review `.github/copilot-instructions.md` for code conventions

---

_Last Updated: December 4, 2025_
