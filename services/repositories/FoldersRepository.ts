import { eq, and, desc, sql, or, asc } from 'drizzle-orm';
import { db, folders, generateLocalId, FolderRecord, NewFolderRecord, SyncStatus } from '../db';
import { Folder } from '../../data/types';

export interface LocalFolder {
  id: string;
  serverId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
  sortOrder: number;
  parentId: string | null;
  depth: number;
  syncStatus: SyncStatus;
  localUpdatedAt: string;
  serverUpdatedAt: string | null;
  isDeleted: boolean;
}

export interface CreateFolderInput {
  name: string;
  icon?: string;
  color?: string;
  isSystem?: boolean;
  sortOrder?: number;
  parentId?: string;
  depth?: number;
  serverId?: string; // When hydrating from server
}

export interface UpdateFolderInput {
  name?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  parentId?: string | null;
  depth?: number;
}

function recordToLocalFolder(record: FolderRecord): LocalFolder {
  return {
    id: record.id,
    serverId: record.serverId,
    name: record.name,
    icon: record.icon,
    color: record.color,
    isSystem: record.isSystem ?? false,
    sortOrder: record.sortOrder ?? 0,
    parentId: record.parentId,
    depth: record.depth ?? 0,
    syncStatus: record.syncStatus,
    localUpdatedAt: record.localUpdatedAt,
    serverUpdatedAt: record.serverUpdatedAt,
    isDeleted: record.isDeleted ?? false,
  };
}

/**
 * Convert LocalFolder to app Folder type for UI compatibility
 */
export function localFolderToFolder(localFolder: LocalFolder, noteCount: number = 0, children?: Folder[]): Folder {
  return {
    id: localFolder.serverId || localFolder.id, // Use server ID if available
    name: localFolder.name,
    icon: localFolder.icon || 'folder',
    noteCount,
    color: localFolder.color || undefined,
    isSystem: localFolder.isSystem,
    sortOrder: localFolder.sortOrder,
    parentId: localFolder.parentId,
    depth: localFolder.depth,
    children,
  };
}

export class FoldersRepository {
  /**
   * Get all folders
   */
  async getAllFolders(): Promise<LocalFolder[]> {
    const results = await db
      .select()
      .from(folders)
      .where(eq(folders.isDeleted, false))
      .orderBy(asc(folders.sortOrder));

    return results.map(recordToLocalFolder);
  }

  /**
   * Get a single folder by ID (local or server ID)
   */
  async getFolderById(id: string): Promise<LocalFolder | null> {
    const results = await db
      .select()
      .from(folders)
      .where(or(eq(folders.id, id), eq(folders.serverId, id)));

    if (results.length === 0) return null;
    return recordToLocalFolder(results[0]);
  }

  /**
   * Get a folder by server ID
   */
  async getFolderByServerId(serverId: string): Promise<LocalFolder | null> {
    const results = await db
      .select()
      .from(folders)
      .where(eq(folders.serverId, serverId));

    if (results.length === 0) return null;
    return recordToLocalFolder(results[0]);
  }

  /**
   * Create a new folder locally
   */
  async createFolder(input: CreateFolderInput): Promise<LocalFolder> {
    const now = new Date().toISOString();
    const id = generateLocalId();

    const newFolder: NewFolderRecord = {
      id,
      serverId: input.serverId || null,
      name: input.name,
      icon: input.icon || null,
      color: input.color || null,
      isSystem: input.isSystem || false,
      sortOrder: input.sortOrder ?? 0,
      parentId: input.parentId || null,
      depth: input.depth ?? 0,
      syncStatus: input.serverId ? 'synced' : 'pending',
      localUpdatedAt: now,
      serverUpdatedAt: input.serverId ? now : null,
      isDeleted: false,
    };

    await db.insert(folders).values(newFolder);

    const created = await this.getFolderById(id);
    if (!created) throw new Error('Failed to create folder');
    return created;
  }

  /**
   * Update a folder locally
   */
  async updateFolder(id: string, input: UpdateFolderInput): Promise<LocalFolder | null> {
    const now = new Date().toISOString();
    const existing = await this.getFolderById(id);
    if (!existing) return null;

    const updates: Partial<FolderRecord> = {
      localUpdatedAt: now,
      syncStatus: 'pending',
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.icon !== undefined) updates.icon = input.icon;
    if (input.color !== undefined) updates.color = input.color;
    if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
    if (input.parentId !== undefined) updates.parentId = input.parentId;
    if (input.depth !== undefined) updates.depth = input.depth;

    await db
      .update(folders)
      .set(updates)
      .where(eq(folders.id, existing.id));

    return this.getFolderById(existing.id);
  }

  /**
   * Soft delete a folder
   */
  async deleteFolder(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const existing = await this.getFolderById(id);
    if (!existing) return false;

    // Don't allow deleting system folders
    if (existing.isSystem) return false;

    await db
      .update(folders)
      .set({
        isDeleted: true,
        localUpdatedAt: now,
        syncStatus: 'pending',
      })
      .where(eq(folders.id, existing.id));

    return true;
  }

  /**
   * Get child folders of a parent
   */
  async getChildFolders(parentId: string): Promise<LocalFolder[]> {
    const results = await db
      .select()
      .from(folders)
      .where(and(eq(folders.isDeleted, false), eq(folders.parentId, parentId)))
      .orderBy(asc(folders.sortOrder));

    return results.map(recordToLocalFolder);
  }

  /**
   * Get all folders pending sync
   */
  async getPendingFolders(): Promise<LocalFolder[]> {
    const results = await db
      .select()
      .from(folders)
      .where(eq(folders.syncStatus, 'pending'))
      .orderBy(folders.localUpdatedAt);

    return results.map(recordToLocalFolder);
  }

  /**
   * Mark a folder as synced
   */
  async markFolderSynced(localId: string, serverId: string, serverUpdatedAt: string): Promise<void> {
    await db
      .update(folders)
      .set({
        serverId,
        syncStatus: 'synced',
        serverUpdatedAt,
      })
      .where(eq(folders.id, localId));
  }

  /**
   * Upsert a folder from server data
   */
  async upsertFromServer(serverFolder: {
    id: string;
    name: string;
    icon?: string;
    color?: string;
    isSystem?: boolean;
    sortOrder?: number;
    parentId?: string;
    depth?: number;
    updatedAt: string;
  }): Promise<LocalFolder> {
    // First check if we already have this folder by server ID
    const existing = await this.getFolderByServerId(serverFolder.id);

    if (existing) {
      // Update existing folder if server is newer
      if (!existing.serverUpdatedAt || serverFolder.updatedAt > existing.serverUpdatedAt) {
        await db
          .update(folders)
          .set({
            name: serverFolder.name,
            icon: serverFolder.icon || null,
            color: serverFolder.color || null,
            isSystem: serverFolder.isSystem || false,
            sortOrder: serverFolder.sortOrder ?? 0,
            parentId: serverFolder.parentId || null,
            depth: serverFolder.depth ?? 0,
            serverUpdatedAt: serverFolder.updatedAt,
            syncStatus: 'synced',
          })
          .where(eq(folders.id, existing.id));
      }
      return (await this.getFolderById(existing.id))!;
    }

    // For system folders, check if we have a local version without serverId that should be linked
    if (serverFolder.isSystem) {
      const allFolders = await this.getAllFolders();
      const matchingLocal = allFolders.find(
        f => f.name === serverFolder.name && f.isSystem && !f.serverId
      );

      if (matchingLocal) {
        // Link existing local folder to server
        await db
          .update(folders)
          .set({
            serverId: serverFolder.id,
            icon: serverFolder.icon || matchingLocal.icon,
            color: serverFolder.color || matchingLocal.color,
            sortOrder: serverFolder.sortOrder ?? matchingLocal.sortOrder,
            serverUpdatedAt: serverFolder.updatedAt,
            syncStatus: 'synced',
          })
          .where(eq(folders.id, matchingLocal.id));

        console.log(`[FoldersRepository] Linked local "${serverFolder.name}" to server ID: ${serverFolder.id}`);
        return (await this.getFolderById(matchingLocal.id))!;
      }
    }

    // Create new folder from server
    return this.createFolder({
      serverId: serverFolder.id,
      name: serverFolder.name,
      icon: serverFolder.icon,
      color: serverFolder.color,
      isSystem: serverFolder.isSystem,
      sortOrder: serverFolder.sortOrder,
      parentId: serverFolder.parentId,
      depth: serverFolder.depth,
    });
  }

  /**
   * Reorder folders
   */
  async reorderFolders(orders: Array<{ id: string; sortOrder: number; parentId?: string; depth?: number }>): Promise<void> {
    const now = new Date().toISOString();

    for (const order of orders) {
      const existing = await this.getFolderById(order.id);
      if (!existing) continue;

      const updates: Partial<FolderRecord> = {
        sortOrder: order.sortOrder,
        localUpdatedAt: now,
        syncStatus: 'pending',
      };

      if (order.parentId !== undefined) updates.parentId = order.parentId;
      if (order.depth !== undefined) updates.depth = order.depth;

      await db
        .update(folders)
        .set(updates)
        .where(eq(folders.id, existing.id));
    }
  }

  /**
   * Get count of folders by sync status
   */
  async getSyncStatusCounts(): Promise<{ pending: number; synced: number; conflict: number }> {
    const pending = await db
      .select({ count: sql<number>`count(*)` })
      .from(folders)
      .where(and(eq(folders.syncStatus, 'pending'), eq(folders.isDeleted, false)));

    const synced = await db
      .select({ count: sql<number>`count(*)` })
      .from(folders)
      .where(and(eq(folders.syncStatus, 'synced'), eq(folders.isDeleted, false)));

    const conflict = await db
      .select({ count: sql<number>`count(*)` })
      .from(folders)
      .where(and(eq(folders.syncStatus, 'conflict'), eq(folders.isDeleted, false)));

    return {
      pending: pending[0]?.count || 0,
      synced: synced[0]?.count || 0,
      conflict: conflict[0]?.count || 0,
    };
  }

  /**
   * Setup default folders locally if they don't exist
   * Called during database initialization
   */
  async setupDefaultFolders(): Promise<void> {
    const existingFolders = await this.getAllFolders();

    // Check if "All Notes" folder exists (by name and isSystem)
    const hasAllNotes = existingFolders.some(f => f.name === 'All Notes' && f.isSystem);

    if (!hasAllNotes) {
      const now = new Date().toISOString();

      // Create "All Notes" system folder
      // Set syncStatus to 'synced' since this is a system folder that exists on server
      await db.insert(folders).values({
        id: 'local_all_notes',
        serverId: null,
        name: 'All Notes',
        icon: 'tray.full',
        color: null,
        isSystem: true,
        sortOrder: 0,
        parentId: null,
        depth: 0,
        syncStatus: 'synced', // Don't sync - server has this folder
        localUpdatedAt: now,
        serverUpdatedAt: null,
        isDeleted: false,
      });

      console.log('[FoldersRepository] Created default "All Notes" folder');
    } else {
      console.log('[FoldersRepository] "All Notes" folder already exists');
    }
  }

  /**
   * Link local system folder to server folder by name
   * Called when hydrating to merge local default folders with server folders
   */
  async linkSystemFolderToServer(serverFolder: {
    id: string;
    name: string;
    isSystem?: boolean;
    updatedAt: string;
  }): Promise<void> {
    // Find local system folder with matching name
    const existingFolders = await this.getAllFolders();
    const localFolder = existingFolders.find(
      f => f.name === serverFolder.name && f.isSystem && !f.serverId
    );

    if (localFolder) {
      // Update local folder with server ID
      await db
        .update(folders)
        .set({
          serverId: serverFolder.id,
          serverUpdatedAt: serverFolder.updatedAt,
          syncStatus: 'synced',
        })
        .where(eq(folders.id, localFolder.id));

      console.log(`[FoldersRepository] Linked local "${serverFolder.name}" to server ID: ${serverFolder.id}`);
    }
  }

  /**
   * Check if default folders exist
   */
  async hasDefaultFolders(): Promise<boolean> {
    const existingFolders = await this.getAllFolders();
    return existingFolders.some(f => f.name === 'All Notes' && f.isSystem);
  }
}

// Export singleton instance
export const foldersRepository = new FoldersRepository();
