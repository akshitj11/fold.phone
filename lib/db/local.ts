import * as SQLite from 'expo-sqlite';

export interface MemoryQueueRow {
  id: number;
  encrypted_content: string;
  ciphertext: string;
  data_hash: string;
  access_conditions: string;
  synced: number;
  created_at: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('fold.db');
  }

  const db = await dbPromise;
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS memory_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      encrypted_content TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      data_hash TEXT NOT NULL,
      access_conditions TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  );

  return db;
}

export async function enqueueMemory(data: {
  encrypted_content: string;
  ciphertext: string;
  data_hash: string;
  access_conditions: string;
}): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO memory_queue (encrypted_content, ciphertext, data_hash, access_conditions, synced)
     VALUES (?, ?, ?, ?, 0);`,
    [
      data.encrypted_content,
      data.ciphertext,
      data.data_hash,
      data.access_conditions,
    ],
  );

  return result.lastInsertRowId;
}

export async function getPendingMemories(): Promise<MemoryQueueRow[]> {
  const db = await getDb();
  return db.getAllAsync<MemoryQueueRow>(
    `SELECT id, encrypted_content, ciphertext, data_hash, access_conditions, synced, created_at
     FROM memory_queue
     WHERE synced = 0
     ORDER BY id ASC;`,
  );
}

export async function markSynced(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE memory_queue SET synced = 1 WHERE id = ?;`, [id]);
}
