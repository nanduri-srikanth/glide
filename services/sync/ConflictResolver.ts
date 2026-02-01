import { LocalNote, notesRepository } from '../repositories/NotesRepository';
import { LocalFolder, foldersRepository } from '../repositories/FoldersRepository';

export interface ConflictInfo {
  entityType: 'note' | 'folder' | 'action';
  entityId: string;
  localVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  localUpdatedAt: string;
  serverUpdatedAt: string;
}

export type ConflictResolution = 'keep_local' | 'keep_server' | 'merge' | 'create_copy';

export interface ConflictResult {
  resolved: boolean;
  resolution: ConflictResolution;
  conflictCopyId?: string;
}

/**
 * Handles conflict detection and resolution between local and server data
 * Uses last-write-wins with server authority, but creates local backup copies
 * when there are significant differences
 */
export class ConflictResolver {
  /**
   * Check if there's a conflict between local and server versions
   */
  hasConflict(local: { localUpdatedAt: string; serverUpdatedAt: string | null }, serverUpdatedAt: string): boolean {
    // No conflict if local has never been synced (it's a new local item)
    if (!local.serverUpdatedAt) {
      return false;
    }

    // No conflict if server hasn't been updated since last sync
    if (serverUpdatedAt <= local.serverUpdatedAt) {
      return false;
    }

    // Conflict if local has changes AND server has newer changes
    if (local.localUpdatedAt > local.serverUpdatedAt && serverUpdatedAt > local.serverUpdatedAt) {
      return true;
    }

    return false;
  }

  /**
   * Detect if changes are significant enough to warrant a conflict copy
   */
  hasSignificantDifferences(local: Record<string, unknown>, server: Record<string, unknown>, entityType: 'note' | 'folder' | 'action'): boolean {
    if (entityType === 'note') {
      // Check title and transcript for significant changes
      const localTitle = String(local.title || '').trim();
      const serverTitle = String(server.title || '').trim();
      const localTranscript = String(local.transcript || '').trim();
      const serverTranscript = String(server.transcript || '').trim();

      // Title changed significantly
      if (localTitle !== serverTitle && this.getLevenshteinDistance(localTitle, serverTitle) > 5) {
        return true;
      }

      // Transcript has significant differences (more than 10% change)
      if (localTranscript && serverTranscript) {
        const distance = this.getLevenshteinDistance(localTranscript, serverTranscript);
        const maxLength = Math.max(localTranscript.length, serverTranscript.length);
        if (distance / maxLength > 0.1) {
          return true;
        }
      }

      return false;
    }

    if (entityType === 'folder') {
      // Folders rarely have significant conflicts
      return false;
    }

    // Actions - consider any change significant
    return true;
  }

  /**
   * Resolve a conflict using the configured strategy
   */
  async resolveNoteConflict(
    localNote: LocalNote,
    serverNote: {
      id: string;
      title: string;
      transcript?: string;
      summary?: string;
      duration?: number;
      audioUrl?: string;
      folderId?: string;
      tags?: string[];
      aiMetadata?: Record<string, unknown>;
      updatedAt: string;
    },
    strategy: ConflictResolution = 'keep_server'
  ): Promise<ConflictResult> {
    const localData = {
      title: localNote.title,
      transcript: localNote.transcript,
      summary: localNote.summary,
    };

    const serverData = {
      title: serverNote.title,
      transcript: serverNote.transcript,
      summary: serverNote.summary,
    };

    switch (strategy) {
      case 'keep_local':
        // Keep local changes, mark as pending sync
        return { resolved: true, resolution: 'keep_local' };

      case 'keep_server':
        // Use server version, but create a copy if there are significant differences
        if (this.hasSignificantDifferences(localData, serverData, 'note')) {
          const copyId = await this.createConflictCopy(localNote);
          await notesRepository.upsertFromServer({
            id: serverNote.id,
            title: serverNote.title,
            transcript: serverNote.transcript,
            summary: serverNote.summary,
            duration: serverNote.duration,
            audioUrl: serverNote.audioUrl,
            folderId: serverNote.folderId,
            tags: serverNote.tags,
            aiMetadata: serverNote.aiMetadata,
            createdAt: localNote.createdAt,
            updatedAt: serverNote.updatedAt,
          });
          return { resolved: true, resolution: 'create_copy', conflictCopyId: copyId };
        } else {
          await notesRepository.upsertFromServer({
            id: serverNote.id,
            title: serverNote.title,
            transcript: serverNote.transcript,
            summary: serverNote.summary,
            duration: serverNote.duration,
            audioUrl: serverNote.audioUrl,
            folderId: serverNote.folderId,
            tags: serverNote.tags,
            aiMetadata: serverNote.aiMetadata,
            createdAt: localNote.createdAt,
            updatedAt: serverNote.updatedAt,
          });
          return { resolved: true, resolution: 'keep_server' };
        }

      case 'merge':
        // Simple merge: keep local content, update metadata from server
        await notesRepository.updateNote(localNote.id, {
          audioUrl: serverNote.audioUrl,
          aiMetadata: serverNote.aiMetadata,
        });
        return { resolved: true, resolution: 'merge' };

      case 'create_copy':
        const copyId = await this.createConflictCopy(localNote);
        await notesRepository.upsertFromServer({
          id: serverNote.id,
          title: serverNote.title,
          transcript: serverNote.transcript,
          summary: serverNote.summary,
          duration: serverNote.duration,
          audioUrl: serverNote.audioUrl,
          folderId: serverNote.folderId,
          tags: serverNote.tags,
          aiMetadata: serverNote.aiMetadata,
          createdAt: localNote.createdAt,
          updatedAt: serverNote.updatedAt,
        });
        return { resolved: true, resolution: 'create_copy', conflictCopyId: copyId };
    }
  }

  /**
   * Create a conflict copy of a note
   */
  private async createConflictCopy(note: LocalNote): Promise<string> {
    const conflictNote = await notesRepository.createNote({
      title: `[Conflict] ${note.title}`,
      transcript: note.transcript || undefined,
      summary: note.summary || undefined,
      duration: note.duration || undefined,
      localAudioPath: note.localAudioPath || undefined,
      folderId: note.folderId || undefined,
      tags: note.tags,
      aiMetadata: note.aiMetadata || undefined,
    });

    console.log(`[ConflictResolver] Created conflict copy: ${conflictNote.id}`);
    return conflictNote.id;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Used to determine how different two versions are
   */
  private getLevenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    // For very long strings, use sampling
    if (a.length > 1000 || b.length > 1000) {
      // Sample first and last 500 chars
      const aSample = a.substring(0, 500) + a.substring(Math.max(0, a.length - 500));
      const bSample = b.substring(0, 500) + b.substring(Math.max(0, b.length - 500));
      return this.getLevenshteinDistanceBasic(aSample, bSample);
    }

    return this.getLevenshteinDistanceBasic(a, b);
  }

  private getLevenshteinDistanceBasic(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Get all notes with conflicts
   */
  async getConflictedNotes(): Promise<LocalNote[]> {
    const allNotes = await notesRepository.getAllNotes();
    return allNotes.filter(n => n.syncStatus === 'conflict');
  }

  /**
   * Clear conflict status for a note
   */
  async clearConflict(noteId: string): Promise<void> {
    const note = await notesRepository.getNoteById(noteId);
    if (note && note.syncStatus === 'conflict') {
      await notesRepository.updateNote(note.id, {});
    }
  }
}

// Export singleton instance
export const conflictResolver = new ConflictResolver();
