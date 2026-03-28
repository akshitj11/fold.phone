import { TimelineColors } from '@/constants/theme';
import { apiRequest } from '@/lib/api';
import { decryptMemory } from '@/lib/encryption';
import { useTimelineStore } from '@/lib/store/timeline-store';
import { usePrivy } from '@privy-io/expo';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SharedMemory {
  id: string;
  type?: 'text' | 'audio' | 'photo' | 'video' | 'story' | null;
  title?: string | null;
  createdAt?: string;
  ciphertext: string;
  dataToEncryptHash: string;
  accessControlConditions: any;
}

function MemoryCard({ item, onPress }: { item: SharedMemory; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.cardTitle}>{item.title || 'Shared Memory'}</Text>
      <Text style={styles.cardSubtitle}>
        {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Tap to decrypt'}
      </Text>
    </Pressable>
  );
}

export default function SharedTabScreen() {
  const router = useRouter();
  const { getAccessToken } = usePrivy();

  const [items, setItems] = useState<SharedMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSharedMemories = useCallback(async () => {
    const result = await apiRequest<SharedMemory[]>('/api/share/received');
    if (!result.error && result.data) {
      setItems(Array.isArray(result.data) ? result.data : []);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchSharedMemories();
  }, [fetchSharedMemories]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSharedMemories();
  };

  const handleOpenMemory = async (item: SharedMemory) => {
    try {
      const token = await getAccessToken();
      const decrypted = await decryptMemory(
        item.ciphertext,
        item.dataToEncryptHash,
        item.accessControlConditions,
        token ? ({ privyJwt: token } as any) : {},
      );

      let parsed: any = null;
      try {
        parsed = JSON.parse(decrypted);
      } catch {
        parsed = { content: decrypted, type: 'text', media: [] };
      }

      const tempId = `shared-${item.id}`;
      const store = useTimelineStore.getState();
      const existing = store.entries.find((entry) => entry.id === tempId);

      if (!existing) {
        useTimelineStore.setState((state) => ({
          entries: [
            {
              id: tempId,
              type: (parsed.type || item.type || 'text') as any,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
              mood: parsed.mood || null,
              caption: parsed.caption || undefined,
              location: parsed.location || undefined,
              content: parsed.content || undefined,
              title: parsed.title || undefined,
              storyContent: parsed.storyContent || undefined,
              pageCount: parsed.pageCount || undefined,
              media: parsed.media || [],
            },
            ...state.entries,
          ],
        }));
      }

      const entryType = (parsed?.type || item.type || 'text') as string;
      if (entryType === 'story') {
        router.push({ pathname: '/story/[id]', params: { id: tempId } });
        return;
      }

      router.push('/(tabs)');
    } catch (error) {
      console.error('[shared] decrypt failed:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={TimelineColors.background} />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={TimelineColors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MemoryCard item={item} onPress={() => handleOpenMemory(item)} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={TimelineColors.primary}
            />
          }
          ListEmptyComponent={<Text style={styles.emptyText}>No shared memories yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TimelineColors.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FDFBF7',
    borderRadius: 12,
    padding: 14,
  },
  cardTitle: {
    color: TimelineColors.textDark,
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    color: 'rgba(0,0,0,0.5)',
    marginTop: 6,
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
    color: 'rgba(0,0,0,0.5)',
  },
});
