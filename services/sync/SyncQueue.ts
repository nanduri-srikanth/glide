import { eq, and, asc, sql } from 'drizzle-orm';
import { db, syncQueue as syncQueueTable, generateLocalId, SyncQueueRecord, NewSyncQueueRecord } from '../db';

export type EntityType = 'note' | 'folder' | 'action';
export type OperationType = 'create' | 'update' | 'delete';

export interface QueuedOperation {
  id: string;
  entityType: EntityType;
  entityId: string;
  operation: OperationType;
  payload: Record<string, unknown> | null;
  priority: number;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  scheduledFor: string | null;
}

export interface QueueOperationInput {
  entityType: EntityType;
  entityId: string;
  operation: OperationType;
  payload?: Record<string, unknown>;
  priority?: number;
  scheduledFor?: string;
}

function recordToQueuedOperation(record: SyncQueueRecord): QueuedOperation {
  return {
    id: record.id,
    entityType: record.entityType as EntityType,
    entityId: record.entityId,
    operation: record.operation as OperationType,
    payload: record.payload ? JSON.parse(record.payload) : null,
    priority: record.priority ?? 0,
    retryCount: record.retryCount ?? 0,
    lastError: record.lastError,
    createdAt: record.createdAt,
    scheduledFor: record.scheduledFor,
  };
}

export class SyncQueue {
  private static MAX_RETRIES = 5;
  private static RETRY_DELAYS = [1000, 5000, 30000, 60000, 300000]; // 1s, 5s, 30s, 1m, 5m

  /**
   * Add an operation to the sync queue
   */
  async enqueue(input: QueueOperationInput): Promise<QueuedOperation> {
    const now = new Date().toISOString();

    // Check if there's already a pending operation for this entity
    const existing = await db
      .select()
      .from(syncQueueTable)
      .where(
        and(
          eq(syncQueueTable.entityType, input.entityType),
          eq(syncQueueTable.entityId, input.entityId)
        )
      );

    if (existing.length > 0) {
      // Merge operations - prioritize delete, then update latest
      const existingOp = existing[0];

      if (input.operation === 'delete') {
        // Delete supersedes all other operations
        await db.update(syncQueueTable)
          .set({
            operation: 'delete',
            payload: null,
            priority: Math.max(input.priority ?? 0, existingOp.priority ?? 0),
          })
          .where(eq(syncQueueTable.id, existingOp.id));
      } else if (existingOp.operation !== 'delete') {
        // Merge update payloads
        const mergedPayload = {
          ...(existingOp.payload ? JSON.parse(existingOp.payload) : {}),
          ...(input.payload || {}),
        };

        await db.update(syncQueueTable)
          .set({
            payload: JSON.stringify(mergedPayload),
            priority: Math.max(input.priority ?? 0, existingOp.priority ?? 0),
          })
          .where(eq(syncQueueTable.id, existingOp.id));
      }

      return recordToQueuedOperation((await this.getById(existingOp.id))!);
    }

    // Create new queue entry
    const id = generateLocalId();
    const newEntry: NewSyncQueueRecord = {
      id,
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      payload: input.payload ? JSON.stringify(input.payload) : null,
      priority: input.priority ?? 0,
      retryCount: 0,
      lastError: null,
      createdAt: now,
      scheduledFor: input.scheduledFor || null,
    };

    await db.insert(syncQueueTable).values(newEntry);

    const created = await this.getById(id);
    if (!created) throw new Error('Failed to create queue entry');
    return recordToQueuedOperation(created);
  }

  /**
   * Get an operation by ID
   */
  private async getById(id: string): Promise<SyncQueueRecord | null> {
    const results = await db
      .select()
      .from(syncQueueTable)
      .where(eq(syncQueueTable.id, id));

    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get all pending operations ready to sync
   */
  async getPendingOperations(): Promise<QueuedOperation[]> {
    const now = new Date().toISOString();

    const results = await db
      .select()
      .from(syncQueueTable)
      .where(
        sql`${syncQueueTable.scheduledFor} IS NULL OR ${syncQueueTable.scheduledFor} <= ${now}`
      )
      .orderBy(asc(syncQueueTable.priority), asc(syncQueueTable.createdAt));

    return results.map(recordToQueuedOperation);
  }

  /**
   * Get count of pending operations
   */
  async getPendingCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(syncQueueTable);

    return result[0]?.count || 0;
  }

  /**
   * Mark an operation as completed (remove from queue)
   */
  async complete(id: string): Promise<void> {
    await db.delete(syncQueueTable).where(eq(syncQueueTable.id, id));
  }

  /**
   * Mark an operation as failed and schedule retry
   */
  async fail(id: string, error: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;

    const retryCount = (existing.retryCount ?? 0) + 1;

    if (retryCount >= SyncQueue.MAX_RETRIES) {
      // Max retries reached, log and remove
      console.error(`[SyncQueue] Max retries reached for ${id}: ${error}`);
      await this.complete(id);
      return false;
    }

    // Schedule retry with exponential backoff
    const delay = SyncQueue.RETRY_DELAYS[Math.min(retryCount - 1, SyncQueue.RETRY_DELAYS.length - 1)];
    const scheduledFor = new Date(Date.now() + delay).toISOString();

    await db.update(syncQueueTable)
      .set({
        retryCount,
        lastError: error,
        scheduledFor,
      })
      .where(eq(syncQueueTable.id, id));

    return true;
  }

  /**
   * Clear all operations for an entity
   */
  async clearForEntity(entityType: EntityType, entityId: string): Promise<void> {
    await db.delete(syncQueueTable)
      .where(
        and(
          eq(syncQueueTable.entityType, entityType),
          eq(syncQueueTable.entityId, entityId)
        )
      );
  }

  /**
   * Clear all operations
   */
  async clearAll(): Promise<void> {
    await db.delete(syncQueueTable);
  }

  /**
   * Get operations by entity type
   */
  async getByEntityType(entityType: EntityType): Promise<QueuedOperation[]> {
    const results = await db
      .select()
      .from(syncQueueTable)
      .where(eq(syncQueueTable.entityType, entityType))
      .orderBy(asc(syncQueueTable.createdAt));

    return results.map(recordToQueuedOperation);
  }
}

// Export singleton instance
export const syncQueue = new SyncQueue();
