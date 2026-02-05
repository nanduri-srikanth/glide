/**
 * Database Manager Service
 *
 * Manages SQLite database connection using expo-sqlite for offline-first data persistence.
 * Provides database initialization, schema migrations, and connection management.
 *
 * Database Schema:
 * - folders: User folders for organizing notes
 * - notes: Voice memos with transcriptions
 * - actions: Calendar events, emails, reminders extracted from notes
 * - sync_queue: Tracks pending changes for background sync
 */

import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// Database name
export const DB_NAME = 'glide.db';

// Database version for migrations
export const DB_VERSION = 1;

// Enable debug logging in development
const DEBUG = __DEV__;

export interface DatabaseStats {
  notesCount: number;
  foldersCount: number;
  actionsCount: number;
  syncQueueCount: number;
  databaseSize: number;
}

/**
 * Database Manager Class
 *
 * Singleton service for managing SQLite database operations.
 * Handles initialization, migrations, and provides utility methods.
 */
class DatabaseManager {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Get or create the database instance
   */
  async getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) {
      return this.db;
    }

    // If initialization is in progress, wait for it
    if (this.isInitializing && this.initPromise) {
      await this.initPromise;
      return this.db!;
    }

    // Initialize the database
    await this.initialize();
    return this.db!;
  }

  /**
   * Initialize the database and create tables
   */
  async initialize(): Promise<void> {
    if (this.db) {
      if (DEBUG) console.log('[Database] Already initialized');
      return;
    }

    if (this.isInitializing) {
      if (DEBUG) console.log('[Database] Initialization already in progress');
      return;
    }

    this.isInitializing = true;

    this.initPromise = (async () => {
      try {
        if (DEBUG) console.log('[Database] Opening database...');

        // Open database
        this.db = await SQLite.openDatabaseAsync(DB_NAME);

        if (DEBUG) console.log('[Database] Database opened successfully');

        // Enable foreign keys
        await this.db.execAsync('PRAGMA foreign_keys = ON;');

        // Create tables
        await this.createTables();

        // Run migrations if needed
        await this.runMigrations();

        if (DEBUG) console.log('[Database] Initialization complete');
      } catch (error) {
        console.error('[Database] Initialization failed:', error);
        throw error;
      } finally {
        this.isInitializing = false;
      }
    })();

    await this.initPromise;
  }

  /**
   * Create all database tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    if (DEBUG) console.log('[Database] Creating tables...');

    // Create folders table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT DEFAULT 'folder.fill',
        color TEXT,
        is_system INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        parent_id TEXT,
        depth INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
      CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
    `);

    // Create notes table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        folder_id TEXT,
        title TEXT NOT NULL,
        transcript TEXT NOT NULL,
        summary TEXT,
        duration INTEGER,
        audio_url TEXT,
        audio_format TEXT,
        tags TEXT DEFAULT '[]',
        is_pinned INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        ai_processed INTEGER DEFAULT 0,
        ai_metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
      CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
      CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON notes(is_deleted);
    `);

    // Create actions table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        title TEXT NOT NULL,
        description TEXT,
        details TEXT DEFAULT '{}',
        scheduled_date TEXT,
        scheduled_end_date TEXT,
        location TEXT,
        attendees TEXT DEFAULT '[]',
        email_to TEXT,
        email_subject TEXT,
        email_body TEXT,
        external_id TEXT,
        external_service TEXT,
        external_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        executed_at TEXT,
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_actions_note_id ON actions(note_id);
      CREATE INDEX IF NOT EXISTS idx_actions_action_type ON actions(action_type);
      CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
      CREATE INDEX IF NOT EXISTS idx_actions_scheduled_date ON actions(scheduled_date);
    `);

    // Create sync_queue table for offline sync
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_error TEXT,
        status TEXT DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at);
    `);

    if (DEBUG) console.log('[Database] Tables created successfully');
  }

  /**
   * Run database migrations
   * Checks the current version and applies any pending migrations
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    if (DEBUG) console.log('[Database] Checking migrations...');

    // Get current version from user_version table
    const result = await this.db.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version'
    );
    const currentVersion = result?.user_version || 0;

    if (DEBUG) console.log(`[Database] Current version: ${currentVersion}, Target: ${DB_VERSION}`);

    if (currentVersion >= DB_VERSION) {
      if (DEBUG) console.log('[Database] Database is up to date');
      return;
    }

    // Apply migrations sequentially
    for (let version = currentVersion + 1; version <= DB_VERSION; version++) {
      if (DEBUG) console.log(`[Database] Applying migration v${version}...`);
      await this.applyMigration(version);
    }

    // Update user_version
    await this.db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);

    if (DEBUG) console.log('[Database] Migrations complete');
  }

  /**
   * Apply a specific migration
   */
  private async applyMigration(version: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    switch (version) {
      case 1:
        // Initial schema is created in createTables()
        break;

      // Future migrations would go here
      // case 2:
      //   await this.db.execAsync(`ALTER TABLE notes ADD COLUMN new_field TEXT;`);
      //   break;

      default:
        throw new Error(`Unknown migration version: ${version}`);
    }
  }

  /**
   * Close the database connection
   * Note: expo-sqlite doesn't actually close databases in the same way as native SQLite
   * This is primarily for cleanup and testing
   */
  async close(): Promise<void> {
    if (this.db) {
      if (DEBUG) console.log('[Database] Closing database...');
      this.db = null;
      if (DEBUG) console.log('[Database] Database closed');
    }
  }

  /**
   * Delete all data (for testing/logout)
   */
  async resetDatabase(): Promise<void> {
    const db = await this.getDatabase();

    if (DEBUG) console.log('[Database] Resetting database...');

    // Drop all tables
    await db.execAsync(`
      DROP TABLE IF EXISTS sync_queue;
      DROP TABLE IF EXISTS actions;
      DROP TABLE IF EXISTS notes;
      DROP TABLE IF EXISTS folders;
    `);

    // Recreate tables
    await this.createTables();

    if (DEBUG) console.log('[Database] Database reset complete');
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<DatabaseStats> {
    const db = await this.getDatabase();

    const [notesCount, foldersCount, actionsCount, syncQueueCount] = await Promise.all([
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM notes'),
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM folders'),
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM actions'),
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_queue'),
    ]);

    return {
      notesCount: notesCount?.count || 0,
      foldersCount: foldersCount?.count || 0,
      actionsCount: actionsCount?.count || 0,
      syncQueueCount: syncQueueCount?.count || 0,
      databaseSize: 0, // Would need file system access to get actual size
    };
  }

  /**
   * Execute a raw SQL query
   * This is a low-level method for advanced use cases
   */
  async executeRaw<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const db = await this.getDatabase();
    return await db.getAllAsync<T>(sql, params);
  }

  /**
   * Begin a transaction
   * Returns a transaction object that can be used to execute multiple queries atomically
   */
  async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    const db = await this.getDatabase();

    await db.execAsync('BEGIN TRANSACTION');

    try {
      const result = await callback();
      await db.execAsync('COMMIT');
      return result;
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  }
}

// Export singleton instance
export const databaseManager = new DatabaseManager();

// Export types
export type { DatabaseManager };
