import { eq, and, sql, or } from 'drizzle-orm';
import { db, actions, generateLocalId, ActionRecord, NewActionRecord, SyncStatus } from '../db';
import { CalendarAction, EmailAction, ReminderAction, NextStepAction, NoteActions } from '../../data/types';

export type ActionType = 'calendar' | 'email' | 'reminder' | 'next_step';

export interface LocalAction {
  id: string;
  serverId: string | null;
  noteId: string;
  actionType: ActionType;
  status: string;
  priority: string | null;
  title: string;
  description: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  location: string | null;
  attendees: string[] | null;
  emailTo: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  syncStatus: SyncStatus;
  localUpdatedAt: string;
  serverUpdatedAt: string | null;
  isDeleted: boolean;
}

export interface CreateActionInput {
  noteId: string;
  actionType: ActionType;
  title: string;
  status?: string;
  priority?: string;
  description?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  location?: string;
  attendees?: string[];
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  serverId?: string;
}

export interface UpdateActionInput {
  title?: string;
  status?: string;
  priority?: string;
  description?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  location?: string;
  attendees?: string[];
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
}

function recordToLocalAction(record: ActionRecord): LocalAction {
  return {
    id: record.id,
    serverId: record.serverId,
    noteId: record.noteId,
    actionType: record.actionType as ActionType,
    status: record.status,
    priority: record.priority,
    title: record.title,
    description: record.description,
    scheduledDate: record.scheduledDate,
    scheduledTime: record.scheduledTime,
    location: record.location,
    attendees: record.attendees ? JSON.parse(record.attendees) : null,
    emailTo: record.emailTo,
    emailSubject: record.emailSubject,
    emailBody: record.emailBody,
    syncStatus: record.syncStatus,
    localUpdatedAt: record.localUpdatedAt,
    serverUpdatedAt: record.serverUpdatedAt,
    isDeleted: record.isDeleted ?? false,
  };
}

/**
 * Convert LocalAction to typed action for UI
 */
export function localActionToTypedAction(action: LocalAction): CalendarAction | EmailAction | ReminderAction | NextStepAction {
  const base = {
    id: action.serverId || action.id,
    source: 'ai' as const,
  };

  switch (action.actionType) {
    case 'calendar':
      return {
        ...base,
        title: action.title,
        date: action.scheduledDate || '',
        time: action.scheduledTime || undefined,
        location: action.location || undefined,
        attendees: action.attendees || undefined,
        status: (action.status as 'created' | 'pending' | 'confirmed') || 'pending',
      };
    case 'email':
      return {
        ...base,
        to: action.emailTo || '',
        subject: action.emailSubject || action.title,
        body: action.emailBody || undefined,
        preview: action.description || undefined,
        status: (action.status as 'draft' | 'sent' | 'scheduled') || 'draft',
        scheduledTime: action.scheduledTime || undefined,
      };
    case 'reminder':
      return {
        ...base,
        title: action.title,
        dueDate: action.scheduledDate || '',
        dueTime: action.scheduledTime || undefined,
        priority: (action.priority as 'low' | 'medium' | 'high') || 'medium',
        status: (action.status as 'pending' | 'completed') || 'pending',
      };
    case 'next_step':
      return {
        ...base,
        title: action.title,
        status: (action.status as 'pending' | 'completed') || 'pending',
      };
  }
}

/**
 * Group actions by type for NoteActions structure
 */
export function groupActionsByType(localActions: LocalAction[]): NoteActions {
  const result: NoteActions = {
    calendar: [],
    email: [],
    reminders: [],
    nextSteps: [],
  };

  for (const action of localActions) {
    if (action.isDeleted) continue;

    switch (action.actionType) {
      case 'calendar':
        result.calendar.push(localActionToTypedAction(action) as CalendarAction);
        break;
      case 'email':
        result.email.push(localActionToTypedAction(action) as EmailAction);
        break;
      case 'reminder':
        result.reminders.push(localActionToTypedAction(action) as ReminderAction);
        break;
      case 'next_step':
        // nextSteps is string[] for backwards compat
        result.nextSteps.push(action.title);
        break;
    }
  }

  return result;
}

export class ActionsRepository {
  /**
   * Get all actions for a note
   */
  async getActionsForNote(noteId: string): Promise<LocalAction[]> {
    const results = await db
      .select()
      .from(actions)
      .where(and(eq(actions.noteId, noteId), eq(actions.isDeleted, false)));

    return results.map(recordToLocalAction);
  }

  /**
   * Get grouped actions for a note (NoteActions format)
   */
  async getGroupedActionsForNote(noteId: string): Promise<NoteActions> {
    const localActions = await this.getActionsForNote(noteId);
    return groupActionsByType(localActions);
  }

  /**
   * Get a single action by ID
   */
  async getActionById(id: string): Promise<LocalAction | null> {
    const results = await db
      .select()
      .from(actions)
      .where(or(eq(actions.id, id), eq(actions.serverId, id)));

    if (results.length === 0) return null;
    return recordToLocalAction(results[0]);
  }

  /**
   * Create a new action locally
   */
  async createAction(input: CreateActionInput): Promise<LocalAction> {
    const now = new Date().toISOString();
    const id = generateLocalId();

    const newAction: NewActionRecord = {
      id,
      serverId: input.serverId || null,
      noteId: input.noteId,
      actionType: input.actionType,
      status: input.status || 'pending',
      priority: input.priority || null,
      title: input.title,
      description: input.description || null,
      scheduledDate: input.scheduledDate || null,
      scheduledTime: input.scheduledTime || null,
      location: input.location || null,
      attendees: input.attendees ? JSON.stringify(input.attendees) : null,
      emailTo: input.emailTo || null,
      emailSubject: input.emailSubject || null,
      emailBody: input.emailBody || null,
      syncStatus: input.serverId ? 'synced' : 'pending',
      localUpdatedAt: now,
      serverUpdatedAt: input.serverId ? now : null,
      isDeleted: false,
    };

    await db.insert(actions).values(newAction);

    const created = await this.getActionById(id);
    if (!created) throw new Error('Failed to create action');
    return created;
  }

  /**
   * Update an action locally
   */
  async updateAction(id: string, input: UpdateActionInput): Promise<LocalAction | null> {
    const now = new Date().toISOString();
    const existing = await this.getActionById(id);
    if (!existing) return null;

    const updates: Partial<ActionRecord> = {
      localUpdatedAt: now,
      syncStatus: 'pending',
    };

    if (input.title !== undefined) updates.title = input.title;
    if (input.status !== undefined) updates.status = input.status;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.description !== undefined) updates.description = input.description;
    if (input.scheduledDate !== undefined) updates.scheduledDate = input.scheduledDate;
    if (input.scheduledTime !== undefined) updates.scheduledTime = input.scheduledTime;
    if (input.location !== undefined) updates.location = input.location;
    if (input.attendees !== undefined) updates.attendees = JSON.stringify(input.attendees);
    if (input.emailTo !== undefined) updates.emailTo = input.emailTo;
    if (input.emailSubject !== undefined) updates.emailSubject = input.emailSubject;
    if (input.emailBody !== undefined) updates.emailBody = input.emailBody;

    await db
      .update(actions)
      .set(updates)
      .where(eq(actions.id, existing.id));

    return this.getActionById(existing.id);
  }

  /**
   * Soft delete an action
   */
  async deleteAction(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const existing = await this.getActionById(id);
    if (!existing) return false;

    await db
      .update(actions)
      .set({
        isDeleted: true,
        localUpdatedAt: now,
        syncStatus: 'pending',
      })
      .where(eq(actions.id, existing.id));

    return true;
  }

  /**
   * Delete all actions for a note
   */
  async deleteActionsForNote(noteId: string): Promise<void> {
    const now = new Date().toISOString();

    await db
      .update(actions)
      .set({
        isDeleted: true,
        localUpdatedAt: now,
        syncStatus: 'pending',
      })
      .where(eq(actions.noteId, noteId));
  }

  /**
   * Get all pending actions
   */
  async getPendingActions(): Promise<LocalAction[]> {
    const results = await db
      .select()
      .from(actions)
      .where(eq(actions.syncStatus, 'pending'));

    return results.map(recordToLocalAction);
  }

  /**
   * Mark an action as synced
   */
  async markActionSynced(localId: string, serverId: string, serverUpdatedAt: string): Promise<void> {
    await db
      .update(actions)
      .set({
        serverId,
        syncStatus: 'synced',
        serverUpdatedAt,
      })
      .where(eq(actions.id, localId));
  }

  /**
   * Upsert actions from server data
   */
  async upsertFromServer(noteId: string, serverActions: Array<{
    id: string;
    type: string;
    title: string;
    status: string;
    priority?: string;
    description?: string;
    scheduled_date?: string;
    scheduled_time?: string;
    location?: string;
    attendees?: string[];
    email_to?: string;
    email_subject?: string;
    email_body?: string;
    updatedAt?: string;
  }>): Promise<void> {
    for (const serverAction of serverActions) {
      const existing = await db
        .select()
        .from(actions)
        .where(eq(actions.serverId, serverAction.id));

      if (existing.length > 0) {
        // Update existing
        const now = new Date().toISOString();
        await db
          .update(actions)
          .set({
            title: serverAction.title,
            status: serverAction.status,
            priority: serverAction.priority || null,
            description: serverAction.description || null,
            scheduledDate: serverAction.scheduled_date || null,
            scheduledTime: serverAction.scheduled_time || null,
            location: serverAction.location || null,
            attendees: serverAction.attendees ? JSON.stringify(serverAction.attendees) : null,
            emailTo: serverAction.email_to || null,
            emailSubject: serverAction.email_subject || null,
            emailBody: serverAction.email_body || null,
            serverUpdatedAt: serverAction.updatedAt || now,
            syncStatus: 'synced',
          })
          .where(eq(actions.id, existing[0].id));
      } else {
        // Create new
        await this.createAction({
          serverId: serverAction.id,
          noteId,
          actionType: serverAction.type as ActionType,
          title: serverAction.title,
          status: serverAction.status,
          priority: serverAction.priority,
          description: serverAction.description,
          scheduledDate: serverAction.scheduled_date,
          scheduledTime: serverAction.scheduled_time,
          location: serverAction.location,
          attendees: serverAction.attendees,
          emailTo: serverAction.email_to,
          emailSubject: serverAction.email_subject,
          emailBody: serverAction.email_body,
        });
      }
    }
  }

  /**
   * Get sync status counts
   */
  async getSyncStatusCounts(): Promise<{ pending: number; synced: number; conflict: number }> {
    const pending = await db
      .select({ count: sql<number>`count(*)` })
      .from(actions)
      .where(and(eq(actions.syncStatus, 'pending'), eq(actions.isDeleted, false)));

    const synced = await db
      .select({ count: sql<number>`count(*)` })
      .from(actions)
      .where(and(eq(actions.syncStatus, 'synced'), eq(actions.isDeleted, false)));

    const conflict = await db
      .select({ count: sql<number>`count(*)` })
      .from(actions)
      .where(and(eq(actions.syncStatus, 'conflict'), eq(actions.isDeleted, false)));

    return {
      pending: pending[0]?.count || 0,
      synced: synced[0]?.count || 0,
      conflict: conflict[0]?.count || 0,
    };
  }
}

// Export singleton instance
export const actionsRepository = new ActionsRepository();
