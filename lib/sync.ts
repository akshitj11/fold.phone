import NetInfo from '@react-native-community/netinfo';
import { apiRequest } from '@/lib/api';
import { getPendingMemories, markSynced, type MemoryQueueRow } from '@/lib/db/local';

let syncTimer: ReturnType<typeof setInterval> | null = null;
let syncInFlight = false;

async function processPendingMemory(memory: MemoryQueueRow): Promise<void> {
  const uploadResult = await apiRequest<{ cid: string }>('/api/upload/ipfs', {
    method: 'POST',
    body: JSON.stringify({
      encrypted_content: memory.encrypted_content,
      ciphertext: memory.ciphertext,
      data_hash: memory.data_hash,
      access_conditions: memory.access_conditions,
    }),
  });

  if (uploadResult.error || !uploadResult.data?.cid) {
    throw new Error(uploadResult.error || 'failed to upload encrypted memory to ipfs');
  }

  const cid = uploadResult.data.cid;

  const memoryResult = await apiRequest('/api/memories', {
    method: 'POST',
    body: JSON.stringify({
      cid,
      created_at: memory.created_at,
      data_hash: memory.data_hash,
      access_conditions: memory.access_conditions,
    }),
  });

  if (memoryResult.error) {
    throw new Error(memoryResult.error);
  }

  const chainResult = await apiRequest('/api/blockchain/record', {
    method: 'POST',
    body: JSON.stringify({ cid }),
  });

  if (chainResult.error) {
    throw new Error(chainResult.error);
  }

  await markSynced(memory.id);
}

export async function syncPendingMemoriesOnce(): Promise<void> {
  if (syncInFlight) return;
  syncInFlight = true;

  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    const pending = await getPendingMemories();
    for (const memory of pending) {
      try {
        await processPendingMemory(memory);
      } catch (error) {
        console.warn('[sync] failed memory sync', memory.id, error);
      }
    }
  } finally {
    syncInFlight = false;
  }
}

export function startSyncWorker(): void {
  if (syncTimer) return;
  syncTimer = setInterval(() => {
    syncPendingMemoriesOnce().catch((error) => {
      console.warn('[sync] worker tick failed', error);
    });
  }, 30_000);

  syncPendingMemoriesOnce().catch((error) => {
    console.warn('[sync] initial run failed', error);
  });
}

export function stopSyncWorker(): void {
  if (!syncTimer) return;
  clearInterval(syncTimer);
  syncTimer = null;
}
