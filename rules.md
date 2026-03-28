# Fold App — Rules & Conventions

This file documents the patterns, architectural decisions, and conventions to follow when contributing to the Fold React Native app.

---

## 1. Architecture Overview

```
app/                   → Expo Router screens (file-based routing)
components/            → Reusable UI components, organized by feature
  timeline/            → Timeline-specific components
  entry/               → Entry creation components
  profile/             → Profile-related components
  icons/               → All SVG icon components (never use emoji for icons)
constants/theme.ts     → The ONLY source of truth for colors and typography
lib/api.ts             → The ONLY way to talk to the backend
lib/store/             → Zustand stores for global state
lib/auth-context.tsx   → Auth compatibility wrapper for Zustand store
fold.config.js         → The ONLY source of truth for app strings, copy, links
assets/images/         → All static image assets
```

---

## 2. Routing Conventions

- All screens live in `app/` using **Expo Router file-based routing**.
- Tab screens go inside `app/(tabs)/`.
- Modal/stack screens are at the root `app/` level (e.g., `app/edit-profile.tsx`).
- Nested dynamic routes go in subdirectories (e.g., `app/story/[id].tsx`).
- The root layout `app/_layout.tsx` handles auth gating and global setup.

---

## 3. Styling Conventions

- **NEVER use hardcoded hex colors inline** — always import from `constants/theme.ts`.
- All styling via `StyleSheet.create()` placed at the bottom of each file.
- The primary brand palette comes from `TimelineColors`:
  - Background: `#EDEADC` (warm parchment)
  - Primary: `#810100` (deep red)
  - Card BG: `#FDFBF7`
- Use `const SCALE = SCREEN_WIDTH / 393` for responsive sizing (design baseline is 393px width).
- Use design tokens from `GOLDEN_RATIO`, `Fonts`, `OnboardingColors` as needed.
- **No emoji** in the UI. Use proper SVG icon components from `components/icons/` instead.

---

## 4. API Calls

- **Always use `apiRequest()`** from `lib/api.ts` — never call `fetch()` directly.
- `apiRequest` handles: privy bearer token injection, error normalization, and base URL.
- Pattern:
  ```ts
  const { data, error } = await apiRequest<ResponseType>('/api/endpoint', { method: 'POST', body: JSON.stringify(payload) });
  if (error) { /* handle error */ return; }
  // use data
  ```
- The API base URL comes from EXPO_PUBLIC_API_URL in .env. Do not duplicate API hosts in screens/components.

---

## 5. Animations & Gestures

- Use **React Native Reanimated** (`react-native-reanimated`) for all animations.
- Use **React Native Gesture Handler** for gestures.
- Shared values via `useSharedValue()`, styles via `useAnimatedStyle()`.
- Callbacks that need to run on the JS thread from the Reanimated worklet use `runOnJS()`.
- Compose complex gestures with `Gesture.Race()`, `Gesture.Exclusive()`, `Gesture.Simultaneous()`.
- Always use `withSpring()` or `withTiming()` — never set shared values directly for animations.

---

## 6. Notifications

- Push notifications run exclusively through **Expo Push Notifications** (no Ably, no WebSockets).
- The `registerPushToken()` function in `lib/store/notification-store.ts` is the only place that requests permissions and registers tokens.
- Call `registerPushToken()` when the user authenticates (from `_layout.tsx`).
- All notification logic on the frontend is gated behind `isExpoGo` checks since Expo Go doesn't support native push.
- To trigger a push notification from the backend, call `publishNotification(userId, payload)` from `fold.backend/src/lib/ably.ts`.

---

## 7. State Management

- Global state uses **Zustand** (stores in `lib/store/`).
- Prefer local `useState` for ephemeral UI state (form inputs, loading flags).
- React Contexts (in `lib/*-context.tsx`) are used for cross-cutting concerns: Auth, Settings, Audio, Timeline.
- Do not use Redux or MobX.

---

## 8. App Configuration & Copy

- **All user-facing strings, URLs, and feature flags** come from `fold.config.js`.
- Import it with `import config from '../fold.config.js'` (or relative path).
- Do not hardcode support emails, website URLs, or legal links — they all live in `config.links`.

---

## 9. TypeScript

- All new code must be TypeScript (`.ts` / `.tsx`).
- Use `interface` for object shapes shared across files; `type` for local unions/intersections.
- Avoid `any`. If casting is necessary, add an inline comment explaining why.
- Prop types for components must be defined as an `interface` directly above the component.

---

## 10. Icons

- All icons are custom SVG components in `components/icons/`.
- Import only named icon components — do not use emoji or platform icon libraries.
- Icon components accept a `size` prop (number, in logical pixels) and optionally `color`.
- Create a new icon component in `components/icons/` if a design requires a new icon.

---

## 11. Media Handling

- Photo/video flows use expo-image-picker; encrypted payload sync runs through /api/upload/ipfs.
- Audio recording uses `expo-audio`.
- All media is stored in `assets/images/` (local) or relayed to IPFS (remote encrypted content).
- Thumbnails and preview URIs are stored alongside media entries in the backend.

---

## 12. Security

- **Never commit `google-services.json`, `.env`, or any secret files**.
- `google-services.json` is in `.gitignore` — keep it local only.
- Requests use Privy access tokens in Authorization bearer headers.
- Biometric lock is implemented in `lib/biometric-lock.tsx` for additional protection.
