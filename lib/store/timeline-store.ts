import type { MoodType } from '@/components/mood';
import {
  deleteTimelineEntry,
  getOnThisDayEntries,
  getTimelineEntries,
  type OnThisDayGroup,
  type TimelineEntryResponse,
} from '@/lib/api';
import type { AccessControlConditions } from '@lit-protocol/auth-helpers';
import { enqueueMemory } from '@/lib/db/local';
import { encryptMemory } from '@/lib/encryption';
import { syncPendingMemoriesOnce } from '@/lib/sync';
import { Alert } from 'react-native';
import { create } from 'zustand';
import { useAuthStore } from './auth-store';

export type EntryType = 'text' | 'audio' | 'photo' | 'video' | 'story';

export interface EntryMedia {
  id?: string;
  uri: string;
  type: 'image' | 'video' | 'audio';
  thumbnailUri?: string;
  duration?: number;
}

export interface TimelineEntry {
  id: string;
  type: EntryType;
  createdAt: Date;
  mood?: MoodType | null;
  caption?: string;
  location?: string;

  // Text entry
  content?: string;

  // Story entry
  title?: string;
  storyContent?: string;
  pageCount?: number;

  // All media (photos, videos, audio) in one array
  media: EntryMedia[];

  encryptedPayload?: {
    ciphertext: string;
    dataHash: string;
    accessConditions: AccessControlConditions;
  };
}

/** Convert API response shape → local TimelineEntry shape */
function mapResponseToEntry(r: TimelineEntryResponse): TimelineEntry {
  return {
    id: r.id,
    type: r.type,
    createdAt: new Date(r.createdAt),
    mood: (r.mood as MoodType) || null,
    caption: r.caption || undefined,
    location: r.location || undefined,
    content: r.content || undefined,
    title: r.title || undefined,
    storyContent: r.storyContent || undefined,
    pageCount: r.pageCount || undefined,
    media: (r.media || []).map((m) => ({
      id: m.id,
      uri: m.uri,
      type: m.type,
      thumbnailUri: m.thumbnailUri || undefined,
      duration: m.duration || undefined,
    })),
  };
}

function buildMemoryPayload(entry: Omit<TimelineEntry, 'id' | 'createdAt'>): string {
  return JSON.stringify({
    type: entry.type,
    mood: entry.mood || null,
    caption: entry.caption || null,
    content: entry.content || null,
    title: entry.title || null,
    storyContent: entry.storyContent || null,
    pageCount: entry.pageCount || null,
    location: entry.location || null,
    media: entry.media || [],
    createdAt: new Date().toISOString(),
  });
}

interface TimelineState {
  entries: TimelineEntry[];
  onThisDayGroups: OnThisDayGroup[];
  isLoading: boolean;
  isSaving: boolean;
  _lastUserId: string | null;
  /** True if the last refreshEntries or fetchOnThisDay call failed (network etc.) */
  _lastLoadFailed: boolean;

  // Actions
  addEntry: (entry: Omit<TimelineEntry, 'id' | 'createdAt'>) => Promise<TimelineEntry | null>;
  removeEntry: (id: string) => Promise<void>;
  refreshEntries: () => Promise<void>;
  fetchOnThisDay: () => Promise<void>;
  clearEntries: () => void;
  /** Called from StoreInitializer when auth state changes */
  onAuthChange: (isAuthenticated: boolean, userId: string | null) => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  entries: [],
  onThisDayGroups: [],
  isLoading: true,
  isSaving: false,
  _lastUserId: null,
  _lastLoadFailed: false,

  fetchOnThisDay: async () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated || !user) return;
    try {
      const { data, error } = await getOnThisDayEntries();
      if (error) {
        console.error('[Timeline] On-this-day fetch error:', error);
        return;
      }
      if (data) {
        set({ onThisDayGroups: data });
      }
    } catch (err) {
      console.error('[Timeline] On-this-day fetch error:', err);
    }
  },

  refreshEntries: async () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    if (!isAuthenticated || !user) {
      set({ isLoading: true });
      return;
    }

    set({ isLoading: true });
    try {
      const { data, error } = await getTimelineEntries(50, 0);
      if (error) {
        console.error('[Timeline] Fetch error:', error);
        set({ _lastLoadFailed: true });
        return;
      }
      if (data) {
        set({ entries: data.map(mapResponseToEntry), _lastLoadFailed: false });
      }
    } catch (err) {
      console.error('[Timeline] Fetch error:', err);
      set({ _lastLoadFailed: true });
    } finally {
      set({ isLoading: false });
    }
  },

  onAuthChange: (isAuthenticated: boolean, userId: string | null) => {
    const { _lastUserId, refreshEntries, fetchOnThisDay } = get();

    if (isAuthenticated && userId) {
      if (_lastUserId !== userId) {
        console.log('[Timeline] User changed:', _lastUserId, '->', userId);
        set({ _lastUserId: userId, entries: [], onThisDayGroups: [] });
        refreshEntries();
        fetchOnThisDay();
      }
    } else {
      set({ _lastUserId: null, entries: [], onThisDayGroups: [], isLoading: false });
    }
  },

  addEntry: async (entry) => {
    set({ isSaving: true });
    try {
      const { user, isAuthenticated } = useAuthStore.getState();
      if (!isAuthenticated || !user) {
        Alert.alert('Error', 'You must be logged in to save memories.');
        return null;
      }

      const walletAddress = user.walletAddress;
      if (!walletAddress) {
        Alert.alert('Error', 'No embedded wallet found. Please log in again.');
        return null;
      }

      const plainPayload = buildMemoryPayload(entry);
      const encrypted = await encryptMemory(plainPayload, walletAddress);

      const queueId = await enqueueMemory({
        encrypted_content: encrypted.ciphertext,
        ciphertext: encrypted.ciphertext,
        data_hash: encrypted.dataToEncryptHash,
        access_conditions: JSON.stringify(encrypted.accessControlConditions),
      });

      const optimisticEntry: TimelineEntry = {
        id: `local-${queueId}`,
        type: entry.type,
        createdAt: new Date(),
        mood: entry.mood || null,
        caption: entry.caption,
        location: entry.location,
        content: entry.content,
        title: entry.title,
        storyContent: entry.storyContent,
        pageCount: entry.pageCount,
        media: entry.media || [],
        encryptedPayload: {
          ciphertext: encrypted.ciphertext,
          dataHash: encrypted.dataToEncryptHash,
          accessConditions: encrypted.accessControlConditions,
        },
      };

      set((state) => ({ entries: [optimisticEntry, ...state.entries] }));
      Alert.alert('Saved', 'Memory saved locally and queued for sync.');

      syncPendingMemoriesOnce().catch((error) => {
        console.warn('[timeline] background sync failed:', error);
      });

      return optimisticEntry;
    } catch (err) {
      console.error('[Timeline] addEntry error:', err);
      Alert.alert('Save Failed', 'Could not save your memory. Please try again.');
      return null;
    } finally {
      set({ isSaving: false });
    }
  },

  removeEntry: async (id: string) => {
    try {
      const { error } = await deleteTimelineEntry(id);
      if (error) {
        console.error('[Timeline] Delete error:', error);
        return;
      }
      set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
    } catch (err) {
      console.error('[Timeline] removeEntry error:', err);
    }
  },

  clearEntries: () => {
    set({ entries: [], onThisDayGroups: [] });
  },
}));

// Compatibility shim — keeps existing consumers working without any import changes
export function useTimeline() {
  return useTimelineStore();
}
