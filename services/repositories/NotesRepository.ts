import { eq, and, desc, sql, isNull, or, like } from 'drizzle-orm';
import { db, notes, generateLocalId, NoteRecord, NewNoteRecord, SyncStatus } from '../db';
import { Note, NoteActions } from '../../data/types';

export interface LocalNote {
  id: string;
  serverId: string | null;
  title: string;
  transcript: string | null;
  summary: string | null;
  duration: number | null;
  audioUrl: string | null;
  localAudioPath: string | null;
  folderId: string | null;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
  aiProcessed: boolean;
  aiMetadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  localUpdatedAt: string;
  serverUpdatedAt: string | null;
  isDeleted: boolean;
}

export interface CreateNoteInput {
  title?: string;
  transcript?: string;
  summary?: string;
  duration?: number;
  audioUrl?: string;
  localAudioPath?: string;
  folderId?: string;
  tags?: string[];
  aiMetadata?: Record<string, unknown>;
  serverId?: string; // When hydrating from server
}

export interface UpdateNoteInput {
  title?: string;
  transcript?: string;
  summary?: string;
  duration?: number;
  audioUrl?: string;
  localAudioPath?: string;
  folderId?: string;
  tags?: string[];
  isPinned?: boolean;
  isArchived?: boolean;
  aiProcessed?: boolean;
  aiMetadata?: Record<string, unknown>;
}

function recordToLocalNote(record: NoteRecord): LocalNote {
  return {
    id: record.id,
    serverId: record.serverId,
    title: record.title,
    transcript: record.transcript,
    summary: record.summary,
    duration: record.duration,
    audioUrl: record.audioUrl,
    localAudioPath: record.localAudioPath,
    folderId: record.folderId,
    tags: record.tags ? JSON.parse(record.tags) : [],
    isPinned: record.isPinned ?? false,
    isArchived: record.isArchived ?? false,
    aiProcessed: record.aiProcessed ?? false,
    aiMetadata: record.aiMetadata ? JSON.parse(record.aiMetadata) : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    syncStatus: record.syncStatus,
    localUpdatedAt: record.localUpdatedAt,
    serverUpdatedAt: record.serverUpdatedAt,
    isDeleted: record.isDeleted ?? false,
  };
}

/**
 * Convert LocalNote to app Note type for UI compatibility
 */
export function localNoteToNote(localNote: LocalNote, actions?: NoteActions): Note {
  return {
    id: localNote.serverId || localNote.id, // Use server ID if available for API compatibility
    title: localNote.title,
    timestamp: localNote.createdAt,
    transcript: localNote.transcript || '',
    duration: localNote.duration || 0,
    folderId: localNote.folderId || '',
    tags: localNote.tags,
    actions: actions || { calendar: [], email: [], reminders: [], nextSteps: [] },
  };
}

export class NotesRepository {
  /**
   * Get all notes, optionally filtered by folder
   */
  async getAllNotes(folderId?: string): Promise<LocalNote[]> {
    let query = db
      .select()
      .from(notes)
      .where(eq(notes.isDeleted, false))
      .orderBy(desc(notes.createdAt));

    if (folderId) {
      const results = await db
        .select()
        .from(notes)
        .where(and(eq(notes.isDeleted, false), eq(notes.folderId, folderId)))
        .orderBy(desc(notes.createdAt));
      return results.map(recordToLocalNote);
    }

    const results = await query;
    return results.map(recordToLocalNote);
  }

  /**
   * Get a single note by ID (local or server ID)
   */
  async getNoteById(id: string): Promise<LocalNote | null> {
    // Try local ID first, then server ID
    const results = await db
      .select()
      .from(notes)
      .where(or(eq(notes.id, id), eq(notes.serverId, id)));

    if (results.length === 0) return null;
    return recordToLocalNote(results[0]);
  }

  /**
   * Get a note by server ID
   */
  async getNoteByServerId(serverId: string): Promise<LocalNote | null> {
    const results = await db
      .select()
      .from(notes)
      .where(eq(notes.serverId, serverId));

    if (results.length === 0) return null;
    return recordToLocalNote(results[0]);
  }

  /**
   * Create a new note locally
   */
  async createNote(input: CreateNoteInput): Promise<LocalNote> {
    const now = new Date().toISOString();
    const id = generateLocalId();

    const newNote: NewNoteRecord = {
      id,
      serverId: input.serverId || null,
      title: input.title || '',
      transcript: input.transcript || null,
      summary: input.summary || null,
      duration: input.duration || null,
      audioUrl: input.audioUrl || null,
      localAudioPath: input.localAudioPath || null,
      folderId: input.folderId || null,
      tags: input.tags ? JSON.stringify(input.tags) : null,
      isPinned: false,
      isArchived: false,
      aiProcessed: false,
      aiMetadata: input.aiMetadata ? JSON.stringify(input.aiMetadata) : null,
      createdAt: now,
      updatedAt: now,
      syncStatus: input.serverId ? 'synced' : 'pending',
      localUpdatedAt: now,
      serverUpdatedAt: input.serverId ? now : null,
      isDeleted: false,
    };

    await db.insert(notes).values(newNote);

    const created = await this.getNoteById(id);
    if (!created) throw new Error('Failed to create note');
    return created;
  }

  /**
   * Update a note locally
   */
  async updateNote(id: string, input: UpdateNoteInput): Promise<LocalNote | null> {
    const now = new Date().toISOString();
    const existing = await this.getNoteById(id);
    if (!existing) return null;

    const updates: Partial<NoteRecord> = {
      updatedAt: now,
      localUpdatedAt: now,
      syncStatus: 'pending',
    };

    if (input.title !== undefined) updates.title = input.title;
    if (input.transcript !== undefined) updates.transcript = input.transcript;
    if (input.summary !== undefined) updates.summary = input.summary;
    if (input.duration !== undefined) updates.duration = input.duration;
    if (input.audioUrl !== undefined) updates.audioUrl = input.audioUrl;
    if (input.localAudioPath !== undefined) updates.localAudioPath = input.localAudioPath;
    if (input.folderId !== undefined) updates.folderId = input.folderId;
    if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);
    if (input.isPinned !== undefined) updates.isPinned = input.isPinned;
    if (input.isArchived !== undefined) updates.isArchived = input.isArchived;
    if (input.aiProcessed !== undefined) updates.aiProcessed = input.aiProcessed;
    if (input.aiMetadata !== undefined) updates.aiMetadata = JSON.stringify(input.aiMetadata);

    await db
      .update(notes)
      .set(updates)
      .where(eq(notes.id, existing.id));

    return this.getNoteById(existing.id);
  }

  /**
   * Soft delete a note
   */
  async deleteNote(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const existing = await this.getNoteById(id);
    if (!existing) return false;

    await db
      .update(notes)
      .set({
        isDeleted: true,
        updatedAt: now,
        localUpdatedAt: now,
        syncStatus: 'pending',
      })
      .where(eq(notes.id, existing.id));

    return true;
  }

  /**
   * Search notes by title or transcript
   */
  async searchNotes(query: string): Promise<LocalNote[]> {
    const searchPattern = `%${query}%`;
    const results = await db
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.isDeleted, false),
          or(
            like(notes.title, searchPattern),
            like(notes.transcript, searchPattern)
          )
        )
      )
      .orderBy(desc(notes.createdAt));

    return results.map(recordToLocalNote);
  }

  /**
   * Get all notes pending sync
   */
  async getPendingNotes(): Promise<LocalNote[]> {
    const results = await db
      .select()
      .from(notes)
      .where(eq(notes.syncStatus, 'pending'))
      .orderBy(notes.localUpdatedAt);

    return results.map(recordToLocalNote);
  }

  /**
   * Mark a note as synced
   */
  async markNoteSynced(localId: string, serverId: string, serverUpdatedAt: string): Promise<void> {
    await db
      .update(notes)
      .set({
        serverId,
        syncStatus: 'synced',
        serverUpdatedAt,
      })
      .where(eq(notes.id, localId));
  }

  /**
   * Mark a note as having a conflict
   */
  async markNoteConflict(id: string): Promise<void> {
    await db
      .update(notes)
      .set({ syncStatus: 'conflict' })
      .where(eq(notes.id, id));
  }

  /**
   * Upsert a note from server data (for initial hydration or sync)
   */
  async upsertFromServer(serverNote: {
    id: string;
    title: string;
    transcript?: string;
    summary?: string;
    duration?: number;
    audioUrl?: string;
    folderId?: string;
    tags?: string[];
    aiMetadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }): Promise<LocalNote> {
    const existing = await this.getNoteByServerId(serverNote.id);
    const now = new Date().toISOString();

    if (existing) {
      // Update existing note if server is newer
      if (!existing.serverUpdatedAt || serverNote.updatedAt > existing.serverUpdatedAt) {
        await db
          .update(notes)
          .set({
            title: serverNote.title,
            transcript: serverNote.transcript || null,
            summary: serverNote.summary || null,
            duration: serverNote.duration || null,
            audioUrl: serverNote.audioUrl || null,
            folderId: serverNote.folderId || null,
            tags: serverNote.tags ? JSON.stringify(serverNote.tags) : null,
            aiMetadata: serverNote.aiMetadata ? JSON.stringify(serverNote.aiMetadata) : null,
            updatedAt: serverNote.updatedAt,
            serverUpdatedAt: serverNote.updatedAt,
            syncStatus: 'synced',
          })
          .where(eq(notes.id, existing.id));
      }
      return (await this.getNoteById(existing.id))!;
    }

    // Create new note from server
    return this.createNote({
      serverId: serverNote.id,
      title: serverNote.title,
      transcript: serverNote.transcript,
      summary: serverNote.summary,
      duration: serverNote.duration,
      audioUrl: serverNote.audioUrl,
      folderId: serverNote.folderId,
      tags: serverNote.tags,
      aiMetadata: serverNote.aiMetadata,
    });
  }

  /**
   * Get count of notes by sync status
   */
  async getSyncStatusCounts(): Promise<{ pending: number; synced: number; conflict: number }> {
    const pending = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(and(eq(notes.syncStatus, 'pending'), eq(notes.isDeleted, false)));

    const synced = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(and(eq(notes.syncStatus, 'synced'), eq(notes.isDeleted, false)));

    const conflict = await db
      .select({ count: sql<number>`count(*)` })
      .from(notes)
      .where(and(eq(notes.syncStatus, 'conflict'), eq(notes.isDeleted, false)));

    return {
      pending: pending[0]?.count || 0,
      synced: synced[0]?.count || 0,
      conflict: conflict[0]?.count || 0,
    };
  }

  /**
   * Get notes updated after a specific timestamp
   */
  async getNotesUpdatedAfter(timestamp: string): Promise<LocalNote[]> {
    const results = await db
      .select()
      .from(notes)
      .where(sql`${notes.localUpdatedAt} > ${timestamp}`)
      .orderBy(notes.localUpdatedAt);

    return results.map(recordToLocalNote);
  }
}

// Export singleton instance
export const notesRepository = new NotesRepository();
