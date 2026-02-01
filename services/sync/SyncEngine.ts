import { notesRepository, LocalNote } from '../repositories/NotesRepository';
import { foldersRepository, LocalFolder } from '../repositories/FoldersRepository';
import { actionsRepository } from '../repositories/ActionsRepository';
import { syncQueue, QueuedOperation, EntityType, OperationType } from './SyncQueue';
import { conflictResolver } from './ConflictResolver';
import { getSyncMetadata, setSyncMetadata } from '../db';
import notesService, { NoteDetailResponse, FolderResponse, NoteListItem } from '../notes';

export type SyncState = 'idle' | 'syncing' | 'error';

export interface SyncProgress {
  state: SyncState;
  currentOperation?: string;
  processedCount: number;
  totalCount: number;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  pushed: { notes: number; folders: number; actions: number };
  pulled: { notes: number; folders: number };
  conflicts: number;
  errors: string[];
}

type SyncProgressCallback = (progress: SyncProgress) => void;

/**
 * Orchestrates synchronization between local database and server
 */
export class SyncEngine {
  private isSyncing = false;
  private progressCallback?: SyncProgressCallback;

  /**
   * Set callback for sync progress updates
   */
  onProgress(callback: SyncProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: SyncProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * Perform full sync - push local changes then pull server updates
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('[SyncEngine] Sync already in progress');
      return {
        success: false,
        pushed: { notes: 0, folders: 0, actions: 0 },
        pulled: { notes: 0, folders: 0 },
        conflicts: 0,
        errors: ['Sync already in progress'],
      };
    }

    this.isSyncing = true;
    const errors: string[] = [];
    const result: SyncResult = {
      success: true,
      pushed: { notes: 0, folders: 0, actions: 0 },
      pulled: { notes: 0, folders: 0 },
      conflicts: 0,
      errors: [],
    };

    try {
      this.reportProgress({ state: 'syncing', processedCount: 0, totalCount: 0, currentOperation: 'Starting sync...' });

      // Step 1: Push local changes
      const pushResult = await this.pushChanges();
      result.pushed = pushResult.pushed;
      errors.push(...pushResult.errors);

      // Step 2: Pull server updates
      const pullResult = await this.pullChanges();
      result.pulled = pullResult.pulled;
      result.conflicts = pullResult.conflicts;
      errors.push(...pullResult.errors);

      result.errors = errors;
      result.success = errors.length === 0;

      this.reportProgress({ state: 'idle', processedCount: 0, totalCount: 0 });

      console.log('[SyncEngine] Sync completed:', result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown sync error';
      console.error('[SyncEngine] Sync failed:', errorMsg);
      this.reportProgress({ state: 'error', processedCount: 0, totalCount: 0, error: errorMsg });
      return {
        ...result,
        success: false,
        errors: [...errors, errorMsg],
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push local changes to server
   */
  private async pushChanges(): Promise<{ pushed: { notes: number; folders: number; actions: number }; errors: string[] }> {
    const pushed = { notes: 0, folders: 0, actions: 0 };
    const errors: string[] = [];

    // Get pending operations
    const operations = await syncQueue.getPendingOperations();
    const total = operations.length;

    this.reportProgress({
      state: 'syncing',
      currentOperation: `Pushing ${total} changes...`,
      processedCount: 0,
      totalCount: total,
    });

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];

      try {
        await this.processOperation(op);

        switch (op.entityType) {
          case 'note': pushed.notes++; break;
          case 'folder': pushed.folders++; break;
          case 'action': pushed.actions++; break;
        }

        await syncQueue.complete(op.id);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to sync ${op.entityType} ${op.entityId}: ${errorMsg}`);
        await syncQueue.fail(op.id, errorMsg);
      }

      this.reportProgress({
        state: 'syncing',
        currentOperation: `Pushed ${i + 1}/${total}`,
        processedCount: i + 1,
        totalCount: total,
      });
    }

    return { pushed, errors };
  }

  /**
   * Process a single sync operation
   */
  private async processOperation(op: QueuedOperation): Promise<void> {
    switch (op.entityType) {
      case 'note':
        await this.syncNote(op);
        break;
      case 'folder':
        await this.syncFolder(op);
        break;
      case 'action':
        await this.syncAction(op);
        break;
    }
  }

  /**
   * Sync a note operation
   */
  private async syncNote(op: QueuedOperation): Promise<void> {
    const note = await notesRepository.getNoteById(op.entityId);
    if (!note) {
      console.log(`[SyncEngine] Note ${op.entityId} not found, skipping`);
      return;
    }

    switch (op.operation) {
      case 'create': {
        if (note.serverId) {
          // Already synced, skip
          return;
        }

        const result = await notesService.createNote({
          title: note.title,
          transcript: note.transcript || '',
          folder_id: note.folderId || undefined,
          tags: note.tags,
        });

        if (result.error) throw new Error(result.error);
        if (result.data) {
          await notesRepository.markNoteSynced(note.id, result.data.id, result.data.updated_at);
        }
        break;
      }

      case 'update': {
        if (!note.serverId) {
          // Not synced yet, treat as create
          const result = await notesService.createNote({
            title: note.title,
            transcript: note.transcript || '',
            folder_id: note.folderId || undefined,
            tags: note.tags,
          });

          if (result.error) throw new Error(result.error);
          if (result.data) {
            await notesRepository.markNoteSynced(note.id, result.data.id, result.data.updated_at);
          }
          return;
        }

        const payload = op.payload || {};
        const result = await notesService.updateNote(note.serverId, {
          title: (payload.title as string | undefined) ?? note.title,
          transcript: (payload.transcript as string | undefined) ?? (note.transcript || undefined),
          folder_id: (payload.folderId as string | undefined) ?? (note.folderId || undefined),
          tags: (payload.tags as string[] | undefined) ?? note.tags,
          is_pinned: (payload.isPinned as boolean | undefined) ?? note.isPinned,
          is_archived: (payload.isArchived as boolean | undefined) ?? note.isArchived,
        });

        if (result.error) throw new Error(result.error);
        if (result.data) {
          await notesRepository.markNoteSynced(note.id, result.data.id, result.data.updated_at);
        }
        break;
      }

      case 'delete': {
        if (!note.serverId) {
          // Never synced, just remove locally
          return;
        }

        const result = await notesService.deleteNote(note.serverId);
        if (!result.success && result.error) {
          // Ignore 404 errors - already deleted on server
          if (!result.error.includes('404') && !result.error.includes('not found')) {
            throw new Error(result.error);
          }
        }
        break;
      }
    }
  }

  /**
   * Sync a folder operation
   */
  private async syncFolder(op: QueuedOperation): Promise<void> {
    const folder = await foldersRepository.getFolderById(op.entityId);
    if (!folder) {
      console.log(`[SyncEngine] Folder ${op.entityId} not found, skipping`);
      return;
    }

    switch (op.operation) {
      case 'create': {
        if (folder.serverId) return;

        const result = await notesService.createFolder({
          name: folder.name,
          icon: folder.icon || undefined,
          color: folder.color || undefined,
        });

        if (result.error) throw new Error(result.error);
        if (result.data) {
          await foldersRepository.markFolderSynced(folder.id, result.data.id, result.data.created_at);
        }
        break;
      }

      case 'update': {
        if (!folder.serverId) {
          const result = await notesService.createFolder({
            name: folder.name,
            icon: folder.icon || undefined,
            color: folder.color || undefined,
          });

          if (result.error) throw new Error(result.error);
          if (result.data) {
            await foldersRepository.markFolderSynced(folder.id, result.data.id, result.data.created_at);
          }
          return;
        }

        const payload = op.payload || {};
        const result = await notesService.updateFolder(folder.serverId, {
          name: (payload.name as string | undefined) ?? folder.name,
          icon: (payload.icon as string | undefined) ?? (folder.icon || undefined),
          color: (payload.color as string | undefined) ?? (folder.color || undefined),
          sort_order: (payload.sortOrder as number | undefined) ?? folder.sortOrder,
          parent_id: (payload.parentId as string | undefined) ?? folder.parentId,
        });

        if (result.error) throw new Error(result.error);
        if (result.data) {
          await foldersRepository.markFolderSynced(folder.id, result.data.id, result.data.created_at);
        }
        break;
      }

      case 'delete': {
        if (!folder.serverId) return;

        const result = await notesService.deleteFolder(folder.serverId);
        if (!result.success && result.error) {
          if (!result.error.includes('404') && !result.error.includes('not found')) {
            throw new Error(result.error);
          }
        }
        break;
      }
    }
  }

  /**
   * Sync an action operation
   */
  private async syncAction(_op: QueuedOperation): Promise<void> {
    // Actions are synced as part of note updates
    // Individual action syncing can be implemented when needed
    console.log('[SyncEngine] Action sync not yet implemented');
  }

  /**
   * Pull changes from server
   */
  private async pullChanges(): Promise<{ pulled: { notes: number; folders: number }; conflicts: number; errors: string[] }> {
    const pulled = { notes: 0, folders: 0 };
    let conflicts = 0;
    const errors: string[] = [];

    this.reportProgress({
      state: 'syncing',
      currentOperation: 'Pulling server changes...',
      processedCount: 0,
      totalCount: 0,
    });

    try {
      // Pull folders first (notes depend on folders)
      const foldersResult = await notesService.listFolders();
      if (foldersResult.data) {
        for (const serverFolder of foldersResult.data) {
          await this.upsertFolderFromServer(serverFolder);
          pulled.folders++;
        }
      }

      // Pull notes
      const notesResult = await notesService.listNotes({ per_page: 1000 });
      if (notesResult.data) {
        for (const serverNote of notesResult.data.items) {
          const conflictResult = await this.upsertNoteFromServer(serverNote);
          if (conflictResult.hadConflict) conflicts++;
          pulled.notes++;
        }
      }

      // Update last sync timestamp
      await setSyncMetadata('lastSyncAt', new Date().toISOString());
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to pull changes';
      errors.push(errorMsg);
    }

    return { pulled, conflicts, errors };
  }

  /**
   * Upsert a folder from server data
   */
  private async upsertFolderFromServer(serverFolder: FolderResponse): Promise<void> {
    await foldersRepository.upsertFromServer({
      id: serverFolder.id,
      name: serverFolder.name,
      icon: serverFolder.icon,
      color: serverFolder.color || undefined,
      isSystem: serverFolder.is_system,
      sortOrder: serverFolder.sort_order,
      parentId: serverFolder.parent_id || undefined,
      depth: serverFolder.depth,
      updatedAt: serverFolder.created_at, // Use created_at as updatedAt since API doesn't provide it
    });

    // Recursively process children
    if (serverFolder.children) {
      for (const child of serverFolder.children) {
        await this.upsertFolderFromServer(child);
      }
    }
  }

  /**
   * Upsert a note from server data, handling conflicts
   */
  private async upsertNoteFromServer(serverNote: NoteListItem): Promise<{ hadConflict: boolean }> {
    const existing = await notesRepository.getNoteByServerId(serverNote.id);

    if (existing && existing.syncStatus === 'pending') {
      // Check for conflict
      if (conflictResolver.hasConflict(existing, serverNote.updated_at || serverNote.created_at)) {
        // Fetch full note details for conflict resolution
        const fullNoteResult = await notesService.getNote(serverNote.id);
        if (fullNoteResult.data) {
          await conflictResolver.resolveNoteConflict(existing, {
            id: fullNoteResult.data.id,
            title: fullNoteResult.data.title,
            transcript: fullNoteResult.data.transcript,
            summary: fullNoteResult.data.summary || undefined,
            duration: fullNoteResult.data.duration || undefined,
            audioUrl: fullNoteResult.data.audio_url || undefined,
            folderId: fullNoteResult.data.folder_id || undefined,
            tags: fullNoteResult.data.tags,
            aiMetadata: fullNoteResult.data.ai_metadata,
            updatedAt: fullNoteResult.data.updated_at,
          }, 'keep_server');
        }
        return { hadConflict: true };
      }
    }

    // No conflict - just upsert
    await notesRepository.upsertFromServer({
      id: serverNote.id,
      title: serverNote.title,
      folderId: serverNote.folder_id || undefined,
      tags: serverNote.tags,
      duration: serverNote.duration || undefined,
      createdAt: serverNote.created_at,
      updatedAt: serverNote.updated_at || serverNote.created_at,
    });

    return { hadConflict: false };
  }

  /**
   * Initial hydration - fetch all data from server to populate local DB
   */
  async hydrate(): Promise<void> {
    console.log('[SyncEngine] Starting initial hydration...');

    this.reportProgress({
      state: 'syncing',
      currentOperation: 'Downloading your notes...',
      processedCount: 0,
      totalCount: 0,
    });

    try {
      // Fetch folders
      const foldersResult = await notesService.listFolders();
      if (foldersResult.data) {
        for (const folder of foldersResult.data) {
          await this.upsertFolderFromServer(folder);
        }
        console.log(`[SyncEngine] Hydrated ${foldersResult.data.length} folders`);
      }

      // Fetch all notes (paginated)
      let page = 1;
      let totalNotes = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await notesService.listNotes({ page, per_page: 100 });
        if (result.data) {
          for (const note of result.data.items) {
            // Fetch full note details
            const fullNoteResult = await notesService.getNote(note.id);
            if (fullNoteResult.data) {
              await notesRepository.upsertFromServer({
                id: fullNoteResult.data.id,
                title: fullNoteResult.data.title,
                transcript: fullNoteResult.data.transcript,
                summary: fullNoteResult.data.summary || undefined,
                duration: fullNoteResult.data.duration || undefined,
                audioUrl: fullNoteResult.data.audio_url || undefined,
                folderId: fullNoteResult.data.folder_id || undefined,
                tags: fullNoteResult.data.tags,
                aiMetadata: fullNoteResult.data.ai_metadata,
                createdAt: fullNoteResult.data.created_at,
                updatedAt: fullNoteResult.data.updated_at,
              });

              // Hydrate actions
              if (fullNoteResult.data.actions) {
                await actionsRepository.upsertFromServer(
                  fullNoteResult.data.id,
                  fullNoteResult.data.actions.map(a => ({
                    id: a.id,
                    type: a.action_type,
                    title: a.title,
                    status: a.status,
                    priority: a.priority,
                    description: a.description || undefined,
                    scheduled_date: a.scheduled_date || undefined,
                    location: a.location || undefined,
                    attendees: a.attendees,
                    email_to: a.email_to || undefined,
                    email_subject: a.email_subject || undefined,
                    email_body: a.email_body || undefined,
                  }))
                );
              }
            }
            totalNotes++;
          }

          hasMore = page < result.data.pages;
          page++;

          this.reportProgress({
            state: 'syncing',
            currentOperation: `Downloaded ${totalNotes} notes...`,
            processedCount: totalNotes,
            totalCount: result.data.total,
          });
        } else {
          hasMore = false;
        }
      }

      // Mark hydration complete
      await setSyncMetadata('hydrated', 'true');
      await setSyncMetadata('lastSyncAt', new Date().toISOString());

      console.log(`[SyncEngine] Hydration complete: ${totalNotes} notes`);
      this.reportProgress({ state: 'idle', processedCount: 0, totalCount: 0 });
    } catch (error) {
      console.error('[SyncEngine] Hydration failed:', error);
      this.reportProgress({
        state: 'error',
        processedCount: 0,
        totalCount: 0,
        error: error instanceof Error ? error.message : 'Hydration failed',
      });
      throw error;
    }
  }

  /**
   * Check if initial hydration has been done
   */
  async isHydrated(): Promise<boolean> {
    const hydrated = await getSyncMetadata('hydrated');
    return hydrated === 'true';
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncAt(): Promise<string | null> {
    return getSyncMetadata('lastSyncAt');
  }

  /**
   * Queue an operation for sync
   */
  async queueOperation(
    entityType: EntityType,
    entityId: string,
    operation: OperationType,
    payload?: Record<string, unknown>
  ): Promise<void> {
    await syncQueue.enqueue({
      entityType,
      entityId,
      operation,
      payload,
    });
  }

  /**
   * Get count of pending operations
   */
  async getPendingCount(): Promise<number> {
    return syncQueue.getPendingCount();
  }

  /**
   * Check if currently syncing
   */
  get syncing(): boolean {
    return this.isSyncing;
  }
}

// Export singleton instance
export const syncEngine = new SyncEngine();
