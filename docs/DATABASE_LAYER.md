# Local Database Layer Documentation

## Overview

The Local Database Layer provides offline-first data persistence for the Glide mobile app using SQLite via `expo-sqlite`. This layer enables the app to function without network connectivity and automatically syncs changes when the connection is restored.

## Architecture

### Components

1. **DatabaseManager** (`services/database.ts`)
   - Singleton service managing SQLite database connection
   - Handles initialization, migrations, and connection lifecycle
   - Provides transaction support and utility methods

2. **Repositories** (`services/repositories/`)
   - **NoteRepository**: CRUD operations for voice memos and notes
   - **FolderRepository**: Hierarchical folder management
   - **ActionRepository**: Calendar events, emails, reminders
   - **SyncQueueRepository**: Offline change tracking

3. **Database Utilities** (`lib/database.ts`)
   - Initialization and hydration logic
   - Database reset and cleanup utilities
   - Statistics and health checks

## Database Schema

### Tables

#### `folders`
Stores user folders for organizing notes with support for hierarchical nesting.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| user_id | TEXT | Foreign key to users table |
| name | TEXT | Folder name |
| icon | TEXT | SF Symbol name for icon |
| color | TEXT | Hex color code |
| is_system | INTEGER | Flag for system folders (0/1) |
| sort_order | INTEGER | Display order |
| parent_id | TEXT | Parent folder ID (nullable) |
| depth | INTEGER | Nesting depth (0-2) |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

**Indexes:**
- `idx_folders_user_id` on `user_id`
- `idx_folders_parent_id` on `parent_id`

#### `notes`
Stores voice memos with transcriptions and AI-generated content.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| user_id | TEXT | Foreign key to users table |
| folder_id | TEXT | Foreign key to folders table (nullable) |
| title | TEXT | Note title |
| transcript | TEXT | Full transcription text |
| summary | TEXT | AI-generated summary |
| duration | INTEGER | Audio duration in seconds |
| audio_url | TEXT | URL to audio file |
| audio_format | TEXT | Audio format (mp3, m4a, wav) |
| tags | TEXT | JSON array of tags |
| is_pinned | INTEGER | Pin flag (0/1) |
| is_archived | INTEGER | Archive flag (0/1) |
| is_deleted | INTEGER | Soft delete flag (0/1) |
| deleted_at | TEXT | Deletion timestamp |
| ai_processed | INTEGER | AI processing flag (0/1) |
| ai_metadata | TEXT | JSON metadata |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

**Indexes:**
- `idx_notes_user_id` on `user_id`
- `idx_notes_folder_id` on `folder_id`
- `idx_notes_created_at` on `created_at DESC`
- `idx_notes_is_deleted` on `is_deleted`

#### `actions`
Stores AI-extracted actions (calendar events, emails, reminders).

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| note_id | TEXT | Foreign key to notes table |
| action_type | TEXT | Type: calendar/email/reminder/next_step |
| status | TEXT | Status: pending/created/executed/failed/cancelled |
| priority | TEXT | Priority: low/medium/high |
| title | TEXT | Action title |
| description | TEXT | Detailed description |
| details | TEXT | JSON additional data |
| scheduled_date | TEXT | Scheduled date/time |
| scheduled_end_date | TEXT | End date/time for events |
| location | TEXT | Event location |
| attendees | TEXT | JSON array of attendees |
| email_to | TEXT | Email recipient |
| email_subject | TEXT | Email subject |
| email_body | TEXT | Email body |
| external_id | TEXT | External service ID |
| external_service | TEXT | Service name (google/apple) |
| external_url | TEXT | External resource URL |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |
| executed_at | TEXT | Execution timestamp |

**Indexes:**
- `idx_actions_note_id` on `note_id`
- `idx_actions_action_type` on `action_type`
- `idx_actions_status` on `status`
- `idx_actions_scheduled_date` on `scheduled_date`

#### `sync_queue`
Tracks pending changes for background synchronization.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| table_name | TEXT | Table being synced |
| record_id | TEXT | Record ID |
| operation | TEXT | Operation: create/update/delete |
| data | TEXT | JSON record data |
| created_at | TEXT | ISO timestamp |
| attempts | INTEGER | Retry count |
| last_error | TEXT | Last error message |
| status | TEXT | Status: pending/in_progress/completed/failed |

**Indexes:**
- `idx_sync_queue_table` on `table_name`
- `idx_sync_queue_status` on `status`
- `idx_sync_queue_created_at` on `created_at`

## Usage

### Initialization

The database is automatically initialized when the app starts via `DatabaseInitializer` in `app/_layout.tsx`.

```typescript
import { initializeDatabase } from '@/lib/database';

// Manual initialization (if needed)
await initializeDatabase();
```

### NoteRepository

```typescript
import { noteRepository } from '@/services/repositories';

// Create a note
const note = await noteRepository.create({
  user_id: 'user-123',
  folderId: 'folder-456',
  title: 'Meeting Notes',
  transcript: 'Discussed project timeline...',
  tags: ['work', 'meeting'],
  isPinned: false,
  is_archived: false,
  is_deleted: false,
  ai_processed: false,
  ai_metadata: {},
});

// Get note by ID
const retrieved = await noteRepository.getById(note.id);

// Get all notes with filters
const notes = await noteRepository.getAll({
  userId: 'user-123',
  isDeleted: false,
  sortBy: 'created_at',
  sortOrder: 'DESC',
  limit: 20,
});

// Update a note
const updated = await noteRepository.update(note.id, {
  title: 'Updated Title',
  tags: ['work', 'meeting', 'important'],
});

// Soft delete
await noteRepository.softDelete(note.id);

// Restore
await noteRepository.restore(note.id);

// Search notes
const results = await noteRepository.search('project timeline', 'user-123');

// Get recent notes
const recent = await noteRepository.getRecent('user-123', 10);

// Get pinned notes
const pinned = await noteRepository.getPinned('user-123');
```

### FolderRepository

```typescript
import { folderRepository } from '@/services/repositories';

// Create a folder
const folder = await folderRepository.create({
  user_id: 'user-123',
  name: 'Work Projects',
  icon: 'folder.fill',
  color: '#007AFF',
  isSystem: false,
  sortOrder: 0,
  parentId: null,
  depth: 0,
});

// Get root folders (with children)
const rootFolders = await folderRepository.getRootFolders('user-123');

// Get folder children
const children = await folderRepository.getChildren('parent-folder-id');

// Move a folder
await folderRepository.move('folder-id', 'new-parent-id');

// Get folder path (breadcrumb)
const path = await folderRepository.getPath('folder-id');

// Get descendants (all nested folders)
const descendants = await folderRepository.getDescendants('folder-id');

// Reorder folders
await folderRepository.reorder(null, ['folder-1', 'folder-2', 'folder-3']);
```

### ActionRepository

```typescript
import { actionRepository, ActionType, ActionStatus } from '@/services/repositories';

// Create an action
const reminder = await actionRepository.create({
  note_id: 'note-123',
  action_type: ActionType.REMINDER,
  status: ActionStatus.PENDING,
  priority: 'high',
  title: 'Follow up with client',
  scheduled_date: '2024-01-15T10:00:00Z',
  details: {},
  attendees: [],
});

// Get actions by note
const actions = await actionRepository.getByNoteId('note-123');

// Get upcoming actions
const upcoming = await actionRepository.getUpcomingActions(10);

// Get overdue actions
const overdue = await actionRepository.getOverdueActions();

// Mark as executed
await actionRepository.markAsExecuted(reminder.id, 'https://calendar.event/123');

// Mark as failed
await actionRepository.markAsFailed(reminder.id, 'Connection timeout');

// Cancel an action
await actionRepository.cancel(reminder.id);

// Get pending actions (for background processing)
const pending = await actionRepository.getPendingActions(50);
```

### SyncQueueRepository

```typescript
import { syncQueueRepository, SyncOperation } from '@/services/repositories';

// Queue a create operation
const item = await syncQueueRepository.queueCreate(
  'notes',
  'note-123',
  { title: 'New Note', transcript: '...' }
);

// Queue an update
await syncQueueRepository.queueUpdate(
  'notes',
  'note-123',
  { title: 'Updated Title' }
);

// Queue a delete
await syncQueueRepository.queueDelete(
  'notes',
  'note-123',
  { title: 'Deleted Note' }
);

// Get pending items for sync
const pending = await syncQueueRepository.getPending(50);

// Mark item as in progress
await syncQueueRepository.markInProgress(item.id);

// Mark as completed
await syncQueueRepository.markCompleted(item.id);

// Mark as failed with error
await syncQueueRepository.markFailed(item.id, 'Network timeout');

// Get sync queue statistics
const stats = await syncQueueRepository.getStats();
// { pending: 5, inProgress: 2, failed: 1, completed: 100, total: 108 }

// Retry failed items
const retried = await syncQueueRepository.retryFailed(3);

// Clean up completed items
await syncQueueRepository.deleteCompleted();
```

## Transactions

Use transactions for atomic operations:

```typescript
import { databaseManager } from '@/services/database';

await databaseManager.withTransaction(async () => {
  await noteRepository.create(note1Data);
  await noteRepository.create(note2Data);
  await folderRepository.update(folderId, { noteCount: 2 });
  // All operations succeed or all roll back
});
```

## Migrations

Database migrations are handled automatically by `DatabaseManager`. The current version is tracked in the `user_version` pragma.

### Adding a Migration

To add a new migration:

1. Increment `DB_VERSION` in `services/database.ts`
2. Add a case in `applyMigration()` method:

```typescript
private async applyMigration(version: number): Promise<void> {
  if (!this.db) throw new Error('Database not initialized');

  switch (version) {
    case 1:
      // Initial schema (already done)
      break;

    case 2:
      // New migration
      await this.db.execAsync(`
        ALTER TABLE notes ADD COLUMN new_field TEXT;
      `);
      break;

    default:
      throw new Error(`Unknown migration version: ${version}`);
  }
}
```

## Testing

Unit tests are provided in `services/repositories/__tests__/repositories.test.ts`.

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- repositories.test.ts
```

### Mocking

The tests use Jest mocks for `expo-sqlite`. In production, you may need to install additional mock packages:

```bash
npm install --save-dev @testing-library/react-native jest-expo
```

## Performance Considerations

1. **Indexes**: Use indexes on frequently queried columns (already added)
2. **Pagination**: Use `limit` and `offset` for large result sets
3. **Transactions**: Group related operations in transactions
4. **Query Optimization**: Avoid SELECT *, specify only needed columns
5. **Connection Pooling**: DatabaseManager provides singleton instance

## Troubleshooting

### Database is locked

This can happen if multiple operations are running concurrently. Use transactions to serialize access:

```typescript
await databaseManager.withTransaction(async () => {
  // Your operations here
});
```

### Schema errors

If you see "no such table" or "no such column" errors, the database may need to be reset:

```typescript
import { resetDatabase } from '@/lib/database';

await resetDatabase();
```

### Migration errors

If a migration fails, check the error message and:
1. Fix the migration code
2. Reset the database to re-run migrations
3. Increment `DB_VERSION` if needed

## Offline-First Architecture

The database layer supports offline-first operation:

1. **Read**: Always read from local database (fast)
2. **Write**: Write to local database, queue for sync
3. **Sync**: Background process syncs pending changes
4. **Conflict Resolution**: Last-write-wins with timestamp ordering

### Sync Flow

```
User Action → Local DB → Sync Queue → Background Sync → Server
                ↓
            UI Update (immediate)
```

## Future Enhancements

Potential improvements to consider:

1. **Full-Text Search**: Implement FTS5 for better search performance
2. **Incremental Sync**: Only sync changed records since last sync
3. **Conflict Resolution**: More sophisticated merge strategies
4. **Encryption**: Encrypt sensitive data at rest
5. **Backup/Export**: Allow users to export local data
6. **Analytics**: Track database performance metrics

## References

- [expo-sqlite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Offline-First Best Practices](https://www.offlinefirst.org/)
