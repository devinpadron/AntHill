# AntHill - AI Coding Agent Instructions

## Project Overview

AntHill is a React Native/Expo employee management app for small catering businesses, featuring tiered permissions, scheduling, time tracking, and push notifications. Built with TypeScript, Firebase (Auth, Firestore, Storage, Crashlytics, Messaging), and React Navigation.

## Architecture & Data Flow

### Context-Based State Management

The app uses React Context for global state - **never use Redux or other state libraries**:

- `UserContext`: Auth state, user profile, privilege level (`isAdmin`), and current `companyId`
- `CompanyContext`: Active company data and customizable `preferences` (feature flags, forms, work week settings)
- `UploadManagerContext`: File uploads to Firebase Storage with progress tracking
- `NotificationContext`: Push notification handling

**Critical initialization order** (see `App.tsx`):

1. `UploadManagerProvider` → `UserProvider` → `CompanyProvider` → `NavigationContainer` → `NotificationProvider`
2. `CompanyInitializer` sets active company from `user.loggedInCompany` after auth

### Firebase Integration

- **Database switching**: `src/constants/firestore.js` uses `test` database in `__DEV__`, production otherwise
- **Collections structure**: `Companies/{companyId}/{Events|TimeEntries|Users}/{docId}/Attachments`
- **Service layer**: All Firebase operations are in `src/services/*.ts` - never write raw Firestore queries in components
- **Subscriptions**: Use `subscribe*` functions (e.g., `subscribeCurrentUser`, `subscribeAllEvents`) for real-time updates - always unsubscribe in cleanup

### Role-Based Access Control

Three privilege levels defined in `src/types/enums/Role.ts`:

- `OWNER`: Full admin access
- `MANAGER`: Admin access to company features
- `USER`: Staff-level access

Check permissions with `isAdmin` from `UserContext` (true for OWNER/MANAGER). Never hardcode role strings.

## Navigation Structure

- **Auth flow**: `AppNavigator` shows `AuthStack` (login/signup) vs `HomeTabs` based on `loggedIn` state
- **Main tabs** (conditionally rendered based on company preferences):
    - Calendar (always visible)
    - Availability (if `preferences.enableAvailability`)
    - Clock/Timesheet (if `preferences.enableTimeSheet`)
    - Settings (always visible)
- **Navigation ref**: Use `src/navigation/navigationRef.ts` for navigation outside components (e.g., push notifications)

## Development Workflows

### Running the App

```bash
npm start              # Start Expo dev server
npm run ios            # Run iOS simulator
npm run android        # Run Android emulator
npm run format         # Format code with Prettier
npm test               # Run Jest tests
```

### Building & Deployment

- **EAS Build**: Configured in `eas.json` with auto-increment version for production
- **Version checking**: `versionUtils.ts` checks app version against Firestore, shows update alerts
- **Platform configs**: Firebase config files (`google-services.json`, `GoogleService-Info.plist`) are gitignored - use environment variables via `app.config.js`

### Multi-Company Support

Users can work for multiple companies (`user.companies[]`). Switch companies by updating `user.loggedInCompany` in Firestore - this triggers `CompanyContext` to reload preferences and data scopes.

## Code Conventions

### UI Component Library

The app uses a centralized component library in `src/components/ui/` with theme support. **Always use these components instead of raw React Native primitives**:

- **Text**: Theme-aware text with variants (h1, h2, h3, body, caption, small), color presets, alignment, and weight
- **Button**: Configurable button with variants (primary, secondary, outline, text, destructive), sizes, loading states, and icons
- **Card**: Content container with elevation, padding options, and optional press handlers
- **Container**: Layout wrapper with variants (default, card, page) and spacing presets
- **SearchBar**: Search input with clear button and theme-aware styling
- **Avatar**: Profile image with fallback icons, sizes (xs→xl), and notification badges
- **IconButton**: Circular icon-only button with variants (solid, outline, ghost) and color options
- **Badge**: Status indicator with variants (default, primary, success, warning, error, info) and sizes
- **Spacer**: Consistent spacing component with size scale (xs=4, sm=8, md=12, lg=16, xl=20, xxl=24, xxxl=32)

### Theme System

- **Color Resolution**: Use `useTheme()` hook from `src/contexts/ThemeContext` for all color values
- **Theme Colors**: Access via `theme.PrimaryText`, `theme.Background`, `theme.CardBackground`, `theme.LocationBlue`, etc.
- **Light/Dark Support**: All UI components automatically adapt to theme mode - never hardcode colors
- **Color Palettes**: `AntHill_Light` and `AntHill_Dark` in `src/constants/colors.ts` define semantic color tokens

### TypeScript Patterns

- **Models**: Export interfaces from `src/types/models/`, re-export through `src/types/index.ts`
- **No strict mode**: `tsconfig.json` has `strict: false` - avoid adding strict type checks
- **Type imports**: Use named exports, never default exports for types

### Component Structure

- **UI Components**: Always use components from `src/components/ui/` (Text, Button, Card, Container, SearchBar, Avatar, IconButton, Badge, Spacer) instead of creating custom implementations
- **Theme System**: Use `useTheme()` hook from `src/contexts/ThemeContext` for dynamic color resolution - never hardcode hex values
- **Styling**: Always use `StyleSheet.create()` at component bottom
- **Colors**: Reference theme colors via `useTheme()` hook (e.g., `theme.PrimaryText`, `theme.CardBackground`) or `src/constants/colors.ts` for specialized colors
- **Relative imports**: Use `../../` paths, not absolute imports
- **Icons**: Use `@expo/vector-icons` (Ionicons) for consistency

### Service Layer Pattern

All data operations go through `src/services/*.ts`:

- `eventService.ts`: CRUD for events, checklist updates, subscriptions
- `timeEntryService.ts`: Clock in/out, pause/resume, approval workflows
- `userService.ts`: User profile, privilege checks, preferences
- `companyService.ts`: Company preferences, settings
- `notificationService.ts`: FCM token management, topic subscriptions

**Never query Firestore directly in screens/components** - add service functions instead.

### File Upload Pattern

Use `UploadManagerContext` for all file operations:

1. Create `AttachmentItem[]` with local URIs and `isExisting: false`
2. Call `uploadFiles(attachments, companyId, parentId, parentType)` - it handles Firebase Storage + Firestore metadata
3. Track progress via `uploadProgress` map and `isUploading` boolean
4. Video thumbnails: Generate with `expo-video-thumbnails`, upload as separate file with `_thumbnail` suffix

## Common Pitfalls

### Theme and Styling

❌ **Don't**: Hardcode colors or use raw React Native components

```tsx
<View style={{ backgroundColor: "#1d1d27" }}>
	<Text style={{ color: "#ffffff" }}>Hello</Text>
</View>
```

✅ **Do**: Use UI components with theme system

```tsx
import { Container } from "../../components/ui/Container";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../contexts/ThemeContext";

const { theme } = useTheme();

<Container variant="card">
	<Text color="primary">Hello</Text>
</Container>;
```

### Firebase Subscriptions

❌ **Don't**: Create subscriptions without cleanup

```tsx
useEffect(() => {
	subscribeCurrentUser((snapshot) => setUser(snapshot.data()));
}, []);
```

✅ **Do**: Always return unsubscribe function

```tsx
useEffect(() => {
	const unsubscribe = subscribeCurrentUser((snapshot) =>
		setUser(snapshot.data()),
	);
	return unsubscribe;
}, []);
```

### Context Dependencies

❌ **Don't**: Access `CompanyContext` before `UserContext` sets `companyId`
✅ **Do**: Wait for `companyId` to be defined or use `CompanyInitializer` pattern

### Platform-Specific Code

Use Expo's feature detection, not platform checks:

- Prefer `expo-image-picker`, `expo-document-picker` over React Native modules
- Use `expo-build-properties` for native configs instead of manual linking

## Testing

- Jest configured with `@testing-library/react-native`
- Run `npm test:watch` during development
- Coverage reports via `npm test:coverage`
- Husky pre-commit hook runs Prettier formatting

## Key Files to Reference

- `App.tsx`: Provider hierarchy and initialization logic
- `src/contexts/ThemeContext.tsx`: Theme system implementation and useTheme hook
- `src/components/ui/`: Reusable UI component library with theme support
- `src/constants/colors.ts`: AntHill_Light and AntHill_Dark color palettes
- `src/contexts/`: Context patterns and state management examples
- `src/services/`: Firebase operation patterns
- `src/types/`: TypeScript interfaces for domain models
- `app.config.js`: Expo configuration and environment variables
