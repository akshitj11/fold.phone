import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useEmbeddedEthereumWallet, usePrivy, PrivyProvider } from '@privy-io/expo';
import { useFonts } from 'expo-font';
import * as LocalAuthentication from 'expo-local-authentication';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';

import { setAccessTokenGetter } from '@/lib/api';
import { initializeLitClient } from '@/lib/lit';
import { registerPushToken } from '@/lib/store/notification-store';
import { startSyncWorker, stopSyncWorker } from '@/lib/sync';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BiometricLockProvider } from '@/lib/biometric-lock';
import { useAuthStore } from '@/lib/store/auth-store';
import { useSettingsStore } from '@/lib/store/settings-store';
import { useTimelineStore } from '@/lib/store/timeline-store';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'onboarding',
};

// Initializes all Zustand stores on mount and reacts to auth changes.
// Replaces the old nested AuthProvider → TimelineProvider → AudioProvider → SettingsProvider.
function StoreInitializer({ children }: { children: React.ReactNode }) {
  const { isReady, authenticated, user: privyUser, getAccessToken } = usePrivy();
  const { wallets } = useEmbeddedEthereumWallet();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authUser = useAuthStore((s) => s.user);

  // Boot auth on mount
  useEffect(() => {
    useAuthStore.getState().initialize();
    initializeLitClient().catch((error) => {
      console.warn('[lit] initialization failed:', error);
    });
  }, []);

  useEffect(() => {
    setAccessTokenGetter(async () => {
      const token = await getAccessToken();
      return token || null;
    });

    return () => {
      setAccessTokenGetter(null);
    };
  }, [getAccessToken]);

  useEffect(() => {
    if (!isReady) return;

    if (!authenticated || !privyUser) {
      useAuthStore.getState().setPrivyAuth({
        isAuthenticated: false,
        user: null,
      });
      return;
    }

    const walletAddress = wallets?.[0]?.address || null;
    useAuthStore.getState().setPrivyAuth({
      isAuthenticated: true,
      user: {
        id: privyUser.id,
        email: privyUser.email?.address || null,
        walletAddress,
      },
    });
  }, [isReady, authenticated, privyUser, wallets]);

  // When auth state changes, propagate to timeline + settings stores.
  // Only fire loadAll once auth has been resolved (skip the initial false→false mount).
  const authResolvedRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Always propagate auth state to timeline store
    useTimelineStore.getState().onAuthChange(isAuthenticated, authUser?.id ?? null);

    // Register push token when authenticated
    if (isAuthenticated) {
      registerPushToken();
    }

    // Only load settings once we have a definitive auth result
    if (isAuthenticated) {
      authResolvedRef.current = true;
      useSettingsStore.getState().loadAll();
    } else if (authResolvedRef.current) {
      // User logged out — reload to reset settings
      useSettingsStore.getState().loadAll();
    }
  }, [isAuthenticated, authUser?.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      stopSyncWorker();
      return;
    }

    startSyncWorker();
    return () => {
      stopSyncWorker();
    };
  }, [isAuthenticated]);

  // Retry loop: if any store failed to load data (e.g. slow/offline network),
  // automatically retry with increasing delays until success.
  useEffect(() => {
    if (!isAuthenticated) return;

    let attempt = 0;
    const MAX_ATTEMPTS = 5;
    const BASE_DELAY = 3_000; // 3 seconds

    const check = () => {
      const timelineFailed = useTimelineStore.getState()._lastLoadFailed;
      const settingsFailed = useSettingsStore.getState()._lastLoadFailed;

      if (!timelineFailed && !settingsFailed) return; // all good
      if (attempt >= MAX_ATTEMPTS) return; // give up

      attempt++;
      const delay = BASE_DELAY * Math.pow(1.5, attempt - 1); // 3s, 4.5s, 6.75s, ...
      console.log(`[StoreInitializer] Retry #${attempt} in ${Math.round(delay / 1000)}s (timeline=${timelineFailed}, settings=${settingsFailed})`);

      retryTimerRef.current = setTimeout(async () => {
        if (timelineFailed) {
          await useTimelineStore.getState().refreshEntries();
          useTimelineStore.getState().fetchOnThisDay();
        }
        if (settingsFailed) {
          await useSettingsStore.getState().loadAll();
        }
        check(); // schedule next if still failing
      }, delay);
    };

    // Start checking after initial load settles (give 2s for first attempt)
    retryTimerRef.current = setTimeout(check, 2_000);

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [isAuthenticated]);

  return <>{children}</>;
}

// Excluded route segments where screenshots are always allowed
const EXCLUDED_ROOTS = new Set(['onboarding', 'auth']);

// Reactively enables/disables screen capture based on the current route and
// the user's screenshotProtection preference.
function ScreenCaptureGuard() {
  const screenshotProtection = useSettingsStore((s) => s.screenshotProtection);
  const segments = useSegments();
  const activeRef = useRef(false);

  useEffect(() => {
    const root = segments[0] as string | undefined;
    const isSettingsTab = root === '(tabs)' && segments[1] === 'settings';
    const isExcluded = !root || EXCLUDED_ROOTS.has(root) || isSettingsTab;

    const shouldProtect = screenshotProtection && !isExcluded;

    if (shouldProtect && !activeRef.current) {
      activeRef.current = true;
      ScreenCapture.preventScreenCaptureAsync('fold_guard').catch((e) =>
        console.warn('[ScreenCaptureGuard] preventScreenCaptureAsync failed:', e)
      );
      if (Platform.OS === 'ios') {
        ScreenCapture.enableAppSwitcherProtectionAsync(0.5).catch((e) =>
          console.warn('[ScreenCaptureGuard] enableAppSwitcherProtectionAsync failed:', e)
        );
      }
    } else if (!shouldProtect && activeRef.current) {
      activeRef.current = false;
      ScreenCapture.allowScreenCaptureAsync('fold_guard').catch((e) =>
        console.warn('[ScreenCaptureGuard] allowScreenCaptureAsync failed:', e)
      );
      if (Platform.OS === 'ios') {
        ScreenCapture.disableAppSwitcherProtectionAsync().catch((e) =>
          console.warn('[ScreenCaptureGuard] disableAppSwitcherProtectionAsync failed:', e)
        );
      }
    }
  }, [screenshotProtection, segments]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeRef.current) {
        ScreenCapture.allowScreenCaptureAsync('fold_guard').catch(() => { });
        if (Platform.OS === 'ios') {
          ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => { });
        }
      }
    };
  }, []);

  return null;
}

// Protected route wrapper
// Flow: onboarding (first time) → auth → (tabs)
function useProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasSeenOnboarding = useAuthStore((s) => s.hasSeenOnboarding);
  const isLoading = useAuthStore((s) => s.isLoading);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Don't do anything while loading or if onboarding status not yet determined
    if (isLoading || hasSeenOnboarding === null) return;

    const currentRoute = segments[0];

    // Wait for router to be ready (segments populated) before making navigation decisions
    if (currentRoute === undefined) return;

    const isOnboarding = currentRoute === 'onboarding';
    const isAuthScreen = currentRoute === 'auth';

    console.log('[NAV] Route check:', { currentRoute, isAuthenticated, hasSeenOnboarding, isOnboarding, isAuthScreen });

    // First time user - show onboarding (don't redirect if already there)
    if (!hasSeenOnboarding) {
      if (!isOnboarding) {
        console.log('[NAV] First time user, redirecting to onboarding');
        router.replace('/onboarding');
      }
      return;
    }

    // Has seen onboarding but not authenticated - go to auth (don't redirect if already on auth screens)
    if (!isAuthenticated && !isAuthScreen && !isOnboarding) {
      console.log('[NAV] Not authenticated, redirecting to auth');
      router.replace('/auth');
      return;
    }

    // Authenticated user on auth/onboarding screens - go to app
    if (isAuthenticated && (isAuthScreen || isOnboarding)) {
      console.log('[NAV] Authenticated, redirecting to tabs');
      router.replace('/(tabs)');
      return;
    }
  }, [isAuthenticated, segments, isLoading, hasSeenOnboarding]);
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasSeenOnboarding = useAuthStore((s) => s.hasSeenOnboarding);

  const [fontsLoaded] = useFonts({
    'SignPainter': require('../assets/fonts/SignPainterHouseScript.ttf'),
    'JockeyOne': require('../assets/fonts/JockeyOne-Regular.ttf'),
  });

  // Protect routes based on auth state
  useProtectedRoute();

  useEffect(() => {
    // Only hide splash when fonts loaded AND we know where to navigate
    if (fontsLoaded && !isLoading && hasSeenOnboarding !== null) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading, hasSeenOnboarding]);

  // Hide Android navigation bar for immersive experience
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    }
  }, []);

  if (!fontsLoaded || isLoading || hasSeenOnboarding === null) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScreenCaptureGuard />
      <KeyboardProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="change-password" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="appearance" />
            <Stack.Screen name="help" />
            <Stack.Screen name="about" />
            <Stack.Screen name="story/[id]" />
            <Stack.Screen name="stories" />
            <Stack.Screen name="media" />
            <Stack.Screen name="day-view" />
            <Stack.Screen name="emotions" />
            <Stack.Screen name="shares" />
            <Stack.Screen name="shared/[token]" />
            <Stack.Screen name="connect" />
            <Stack.Screen name="entry-story" />
            <Stack.Screen name="entry-audio" options={{ presentation: 'modal' }} />
            <Stack.Screen name="entry-text" options={{ presentation: 'modal' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
          <StatusBar hidden={true} />
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID || '';
  const clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || '';

  return (
    <PrivyProvider appId={appId} clientId={clientId}>
      <StoreInitializer>
        <RootLayoutWithLock />
      </StoreInitializer>
    </PrivyProvider>
  );
}

function RootLayoutWithLock() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <BiometricLockProvider isAuthenticated={isAuthenticated}>
      <ForegroundBiometricGate>
        <RootLayoutNav />
      </ForegroundBiometricGate>
    </BiometricLockProvider>
  );
}

function ForegroundBiometricGate({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const authInFlight = useRef(false);

  const authenticate = async () => {
    if (!isAuthenticated) {
      setIsUnlocked(true);
      return;
    }

    if (authInFlight.current) return;
    authInFlight.current = true;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Fold',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });
      setIsUnlocked(result.success);
    } finally {
      authInFlight.current = false;
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setIsUnlocked(true);
      return;
    }

    setIsUnlocked(false);
    authenticate();
  }, [isAuthenticated]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === 'active' &&
        isAuthenticated
      ) {
        setIsUnlocked(false);
        authenticate();
      }

      appState.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  if (!isUnlocked) {
    return null;
  }

  return <>{children}</>;
}
