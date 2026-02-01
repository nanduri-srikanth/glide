import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

const DATABASE_NAME = 'glide.db';

// Create database connection
const expoDb = openDatabaseSync(DATABASE_NAME);
export const db = drizzle(expoDb, { schema });

// Database version for migrations
const CURRENT_DB_VERSION = 1;

/**
 * Initialize the database with schema
 * This should be called once when the app starts
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Create tables if they don't exist
    await createTables();

    // Run any pending migrations
    await runMigrations();

    console.log('[DB] Database initialized successfully');
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Create all tables
 */
async function createTables(): Promise<void> {
  // Notes table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      title TEXT NOT NULL DEFAULT '',
      transcript TEXT,
      summary TEXT,
      duration INTEGER,
      audio_url TEXT,
      local_audio_path TEXT,
      folder_id TEXT,
      tags TEXT,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      ai_processed INTEGER DEFAULT 0,
      ai_metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      local_updated_at TEXT NOT NULL,
      server_updated_at TEXT,
      is_deleted INTEGER DEFAULT 0
    )
  `);

  // Folders table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      is_system INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      parent_id TEXT,
      depth INTEGER DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      local_updated_at TEXT NOT NULL,
      server_updated_at TEXT,
      is_deleted INTEGER DEFAULT 0
    )
  `);

  // Actions table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      note_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT,
      title TEXT NOT NULL,
      description TEXT,
      scheduled_date TEXT,
      scheduled_time TEXT,
      location TEXT,
      attendees TEXT,
      email_to TEXT,
      email_subject TEXT,
      email_body TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      local_updated_at TEXT NOT NULL,
      server_updated_at TEXT,
      is_deleted INTEGER DEFAULT 0
    )
  `);

  // Sync queue table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT,
      priority INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      scheduled_for TEXT
    )
  `);

  // Audio uploads table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS audio_uploads (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      local_path TEXT NOT NULL,
      file_size INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      upload_progress REAL DEFAULT 0,
      remote_url TEXT,
      transcription TEXT,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    )
  `);

  // Sync metadata table
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Create indexes for common queries
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notes_sync_status ON notes(sync_status)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON notes(is_deleted)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_actions_note_id ON actions(note_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_audio_uploads_status ON audio_uploads(status)`);
}

/**
 * Run database migrations
 */
async function runMigrations(): Promise<void> {
  // Get current version
  const versionResult = await db.select()
    .from(schema.syncMetadata)
    .where(sql`${schema.syncMetadata.key} = 'db_version'`);

  const currentVersion = versionResult.length > 0
    ? parseInt(versionResult[0].value, 10)
    : 0;

  if (currentVersion < CURRENT_DB_VERSION) {
    console.log(`[DB] Migrating from version ${currentVersion} to ${CURRENT_DB_VERSION}`);

    // Run migrations based on version
    // Add migration logic here as needed

    // Update version
    const now = new Date().toISOString();
    if (currentVersion === 0) {
      await db.insert(schema.syncMetadata).values({
        key: 'db_version',
        value: CURRENT_DB_VERSION.toString(),
        updatedAt: now,
      });
    } else {
      await db.update(schema.syncMetadata)
        .set({ value: CURRENT_DB_VERSION.toString(), updatedAt: now })
        .where(sql`${schema.syncMetadata.key} = 'db_version'`);
    }
  }
}

/**
 * Clear all local data (for logout or reset)
 */
export async function clearDatabase(): Promise<void> {
  await db.delete(schema.notes);
  await db.delete(schema.folders);
  await db.delete(schema.actions);
  await db.delete(schema.syncQueue);
  await db.delete(schema.audioUploads);
  await db.delete(schema.syncMetadata);
  console.log('[DB] Database cleared');
}

/**
 * Get sync metadata value
 */
export async function getSyncMetadata(key: string): Promise<string | null> {
  const result = await db.select()
    .from(schema.syncMetadata)
    .where(sql`${schema.syncMetadata.key} = ${key}`);
  return result.length > 0 ? result[0].value : null;
}

/**
 * Set sync metadata value
 */
export async function setSyncMetadata(key: string, value: string): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getSyncMetadata(key);

  if (existing === null) {
    await db.insert(schema.syncMetadata).values({
      key,
      value,
      updatedAt: now,
    });
  } else {
    await db.update(schema.syncMetadata)
      .set({ value, updatedAt: now })
      .where(sql`${schema.syncMetadata.key} = ${key}`);
  }
}

/**
 * Generate a UUID for local entities
 */
export function generateLocalId(): string {
  return 'local_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Re-export schema for convenience
export * from './schema';
