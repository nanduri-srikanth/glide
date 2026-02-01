import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Sync status enum values
export type SyncStatus = 'synced' | 'pending' | 'conflict';

// Notes table - stores all notes locally
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(), // Local UUID
  serverId: text('server_id'), // Server ID once synced (null until synced)

  // Content
  title: text('title').notNull().default(''),
  transcript: text('transcript'),
  summary: text('summary'),
  duration: integer('duration'), // in seconds

  // Audio
  audioUrl: text('audio_url'), // Remote URL from server
  localAudioPath: text('local_audio_path'), // Local file path

  // Organization
  folderId: text('folder_id'),
  tags: text('tags'), // JSON array as string
  isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
  isArchived: integer('is_archived', { mode: 'boolean' }).default(false),

  // AI Processing
  aiProcessed: integer('ai_processed', { mode: 'boolean' }).default(false),
  aiMetadata: text('ai_metadata'), // JSON string

  // Timestamps
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),

  // Sync tracking
  syncStatus: text('sync_status').$type<SyncStatus>().notNull().default('pending'),
  localUpdatedAt: text('local_updated_at').notNull(),
  serverUpdatedAt: text('server_updated_at'),

  // Soft delete
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
});

// Folders table
export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(), // Local UUID
  serverId: text('server_id'), // Server ID once synced

  // Content
  name: text('name').notNull(),
  icon: text('icon'),
  color: text('color'),

  // Hierarchy
  isSystem: integer('is_system', { mode: 'boolean' }).default(false),
  sortOrder: integer('sort_order').default(0),
  parentId: text('parent_id'),
  depth: integer('depth').default(0),

  // Sync tracking
  syncStatus: text('sync_status').$type<SyncStatus>().notNull().default('pending'),
  localUpdatedAt: text('local_updated_at').notNull(),
  serverUpdatedAt: text('server_updated_at'),

  // Soft delete
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
});

// Actions table
export const actions = sqliteTable('actions', {
  id: text('id').primaryKey(), // Local UUID
  serverId: text('server_id'), // Server ID once synced
  noteId: text('note_id').notNull(),

  // Action details
  actionType: text('action_type').notNull(), // 'calendar' | 'email' | 'reminder' | 'next_step'
  status: text('status').notNull().default('pending'), // 'pending' | 'completed' | 'cancelled'
  priority: text('priority'),
  title: text('title').notNull(),
  description: text('description'),

  // Calendar specific
  scheduledDate: text('scheduled_date'),
  scheduledTime: text('scheduled_time'),
  location: text('location'),
  attendees: text('attendees'), // JSON array

  // Email specific
  emailTo: text('email_to'),
  emailSubject: text('email_subject'),
  emailBody: text('email_body'),

  // Sync tracking
  syncStatus: text('sync_status').$type<SyncStatus>().notNull().default('pending'),
  localUpdatedAt: text('local_updated_at').notNull(),
  serverUpdatedAt: text('server_updated_at'),

  // Soft delete
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
});

// Sync queue - tracks pending operations to sync
export const syncQueue = sqliteTable('sync_queue', {
  id: text('id').primaryKey(),

  // What to sync
  entityType: text('entity_type').notNull(), // 'note' | 'folder' | 'action'
  entityId: text('entity_id').notNull(),
  operation: text('operation').notNull(), // 'create' | 'update' | 'delete'

  // Operation data
  payload: text('payload'), // JSON string of changes
  priority: integer('priority').default(0), // Higher = more urgent

  // Retry tracking
  retryCount: integer('retry_count').default(0),
  lastError: text('last_error'),

  // Scheduling
  createdAt: text('created_at').notNull(),
  scheduledFor: text('scheduled_for'), // For delayed operations
});

// Audio uploads - manages audio upload queue
export const audioUploads = sqliteTable('audio_uploads', {
  id: text('id').primaryKey(),
  noteId: text('note_id').notNull(),

  // File info
  localPath: text('local_path').notNull(),
  fileSize: integer('file_size'),

  // Upload status
  status: text('status').notNull().default('pending'), // 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'
  uploadProgress: real('upload_progress').default(0), // 0-1

  // Result
  remoteUrl: text('remote_url'),
  transcription: text('transcription'),

  // Retry tracking
  retryCount: integer('retry_count').default(0),
  lastError: text('last_error'),

  // Timestamps
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
});

// Sync metadata - tracks last sync timestamps and other sync info
export const syncMetadata = sqliteTable('sync_metadata', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Type exports for use in repositories
export type NoteRecord = typeof notes.$inferSelect;
export type NewNoteRecord = typeof notes.$inferInsert;

export type FolderRecord = typeof folders.$inferSelect;
export type NewFolderRecord = typeof folders.$inferInsert;

export type ActionRecord = typeof actions.$inferSelect;
export type NewActionRecord = typeof actions.$inferInsert;

export type SyncQueueRecord = typeof syncQueue.$inferSelect;
export type NewSyncQueueRecord = typeof syncQueue.$inferInsert;

export type AudioUploadRecord = typeof audioUploads.$inferSelect;
export type NewAudioUploadRecord = typeof audioUploads.$inferInsert;
