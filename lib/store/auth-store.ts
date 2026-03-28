import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const ONBOARDING_KEY = 'fold_onboarding_complete';

export interface AuthUser {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  avatar?: string | null;
  walletAddress?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean | null;
  isLoading: boolean;

  initialize: () => Promise<void>;
  setPrivyAuth: (params: {
    isAuthenticated: boolean;
    user: AuthUser | null;
  }) => void;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (userData: Partial<AuthUser>) => void;
  completeOnboarding: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  hasSeenOnboarding: null,
  isLoading: true,

  setPrivyAuth: ({ isAuthenticated, user }) => {
    set({
      isAuthenticated,
      user,
      isLoading: false,
    });
  },

  refreshAuth: async () => {
    try {
      const onboardingComplete = await SecureStore.getItemAsync(ONBOARDING_KEY);
      set({ hasSeenOnboarding: onboardingComplete === 'true' });
    } catch (error) {
      console.error('Error refreshing auth:', error);
      set({ hasSeenOnboarding: false, user: null, isAuthenticated: false, isLoading: false });
    }
  },

  initialize: async () => {
    await get().refreshAuth();
    set({ isLoading: false });
  },

  signOut: async () => {
    try {
      await SecureStore.deleteItemAsync(ONBOARDING_KEY);
      set({ user: null, isAuthenticated: false, hasSeenOnboarding: false, isLoading: false });
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  completeOnboarding: async () => {
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
      set({ hasSeenOnboarding: true });
      console.log('[AUTH] Onboarding marked complete');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  },

  updateUser: (userData: Partial<AuthUser>) => {
    const prev = get().user;
    if (!prev) return;
    const updated = {
      ...prev,
      ...userData,
      image: userData.avatar || userData.image || prev.image,
      avatar: userData.avatar || userData.image || prev.avatar,
    };
    set({ user: updated });
  },
}));

// Compatibility shim — keeps existing consumers working without any import changes
export function useAuth() {
  return useAuthStore();
}
