# Local Database Layer Implementation

## Overview

This document describes the local SQLite database implementation for the Glide iOS app, enabling offline-first data persistence using GRDB.swift.

## Architecture

### Database Stack

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  (ViewModels, Views, etc.)                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Repository Layer                           │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ API Repositories │  │ Local Repositories│                │
│  │ (Network)        │  │ (SQLite)         │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database Manager                           │
│  - Connection Management                                     │
│  - Schema Migrations                                        │
│  - Thread Safety                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      GRDB.swift                             │
│  (SQLite Wrapper)                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SQLite                                 │
│  (On-disk database file)                                    │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. DatabaseManager.swift

**Purpose:** Singleton service managing database connection and schema

**Key Features:**
- Database initialization with Write-Ahead Logging (WAL) for performance
- Automatic schema migrations
- Thread-safe database queue
- Database reset for testing
- Error handling and logging

**Database Location:**
```
~/Library/Application Support/Glide/glide.sqlite3
```

**Configuration:**
- WAL mode enabled (concurrent reads)
- Maximum 5 concurrent readers
- Detailed SQL logging in debug mode

### 2. LocalNoteRepository.swift

**Purpose:** CRUD operations for notes with offline support

**Key Methods:**
- `fetchAll(includeDeleted:)` - Fetch all notes
- `fetchByFolder(folderId:)` - Filter by folder
- `fetchPendingSync()` - Get notes needing sync
- `fetchPinned()` - Get pinned notes
- `fetchArchived()` - Get archived notes
- `search(query:)` - Full-text search
- `insert(_:)` - Create new note
- `update(_:)` - Update existing note
- `delete(id:)` - Soft delete
- `permanentDelete(id:)` - Hard delete

**Database Schema:**
```sql
CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    folder_id TEXT,
    tags TEXT NOT NULL,  -- JSON array
    is_pinned BOOLEAN NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    synced_at DATETIME,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    sync_error TEXT,
    local_audio_path TEXT
);
```

**Indexes:**
- `notes_folder_id_idx` on folder_id
- `notes_sync_status_idx` on sync_status
- `notes_created_at_idx` on created_at

### 3. LocalFolderRepository.swift

**Purpose:** Folder management with hierarchy support

**Key Methods:**
- `fetchAll()` - Get all folders
- `fetchRootFolders()` - Get top-level folders
- `fetchChildren(parentId:)` - Get child folders
- `fetchHierarchy()` - Get full tree structure
- `fetchPath(folderId:)` - Get breadcrumb path
- `move(folderId:toParentId:newSortOrder:)` - Reorganize hierarchy
- `getNextSortOrder(parentId:)` - Get next sort position

**Hierarchy Structure:**
```swift
struct FolderNode {
    let folder: Folder
    var children: [FolderNode] = []
}
```

**Database Schema:**
```sql
CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT,
    color TEXT,
    parent_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    sync_error TEXT,
    is_local_deleted BOOLEAN NOT NULL DEFAULT 0
);
```

### 4. LocalActionRepository.swift

**Purpose:** Action management with note filtering

**Key Methods:**
- `fetchAll()` - Get all actions
- `fetchByNote(noteId:)` - Filter by note
- `fetchPending()` - Get pending actions
- `fetchByType(actionType:)` - Filter by type
- `fetchByStatus(status:)` - Filter by status
- `fetchScheduled()` - Get scheduled actions
- `insert(_:)` - Insert single action
- `insert(_:)` - Batch insert actions
- `deleteByNote(noteId:)` - Delete all actions for a note

**Database Schema:**
```sql
CREATE TABLE actions (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    scheduled_date DATETIME,
    scheduled_end_date DATETIME,
    location TEXT,
    attendees TEXT NOT NULL,  -- JSON array
    email_to TEXT,
    email_subject TEXT,
    email_body TEXT,
    external_id TEXT,
    external_service TEXT,
    external_url TEXT,
    created_at DATETIME NOT NULL,
    executed_at DATETIME,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    sync_error TEXT
);
```

**Indexes:**
- `actions_note_id_idx` on note_id
- `actions_sync_status_idx` on sync_status

### 5. SyncQueueRepository.swift

**Purpose:** Track pending offline changes for sync

**Key Methods:**
- `enqueue(operation:entityType:entityId:payload:)` - Add to queue
- `fetchAll()` - Get all pending changes
- `fetchByEntityType(entityType:)` - Filter by type
- `fetchRetryable(maxAttempts:)` - Get retryable failures
- `markSuccessful(id:)` - Remove from queue
- `markFailed(id:error:)` - Record failure with retry count

**Database Schema:**
```sql
CREATE TABLE sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation TEXT NOT NULL,      -- 'create', 'update', 'delete'
    entity_type TEXT NOT NULL,    -- 'note', 'folder', 'action'
    entity_id TEXT NOT NULL,
    payload TEXT NOT NULL,        -- JSON data
    created_at DATETIME NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
);
```

**Indexes:**
- `sync_queue_entity_idx` on (entity_type, entity_id)
- `sync_queue_created_at_idx` on created_at

## Data Models

### Sync Status
```swift
enum SyncStatus: String, Codable {
    case synced    // In sync with server
    case pending   // Awaiting sync
    case conflict  // Conflict detected
    case error     // Sync failed
}
```

### Sync Operations
```swift
enum SyncOperation: String, Codable {
    case create
    case update
    case delete
}
```

### Sync Entity Types
```swift
enum SyncEntityType: String, Codable {
    case note
    case folder
    case action
}
```

## Usage Examples

### Initializing the Database

```swift
// In GlideApp.swift setupApp()
do {
    try DatabaseManager.shared.initialize()
    try DependencyContainer.shared.initializeDatabaseRepositories()
} catch {
    print("Failed to initialize database: \(error)")
}
```

### Creating a Note

```swift
let note = Note(
    id: UUID().uuidString,
    title: "Meeting Notes",
    content: "Discussion about Q1 roadmap...",
    tags: ["meeting", "work"],
    createdAt: Date(),
    updatedAt: Date()
)

try DependencyContainer.shared.localNoteRepository?.insert(note)
```

### Fetching Notes

```swift
// Get all notes
let notes = try localNoteRepository.fetchAll()

// Get notes in folder
let folderNotes = try localNoteRepository.fetchByFolder(folderId: "folder-123")

// Search notes
let results = try localNoteRepository.search(query: "meeting")
```

### Creating Folder Hierarchy

```swift
let parent = Folder(
    id: UUID().uuidString,
    name: "Work",
    emoji: "💼",
    color: "#3B82F6",
    sortOrder: 0,
    createdAt: Date(),
    updatedAt: Date()
)

let child = Folder(
    id: UUID().uuidString,
    name: "Projects",
    parentId: parent.id,
    sortOrder: 0,
    createdAt: Date(),
    updatedAt: Date()
)

try localFolderRepository.insert(parent)
try localFolderRepository.insert(child)
```

### Queueing Offline Changes

```swift
// Queue a note creation for sync
let payload = NoteCreateRequest(
    title: "Offline Note",
    transcript: "Created while offline",
    folderId: nil,
    tags: []
)

try syncQueueRepository.enqueue(
    operation: .create,
    entityType: .note,
    entityId: note.id,
    payload: payload
)
```

## Performance Optimizations

1. **Write-Ahead Logging (WAL):** Allows concurrent reads during writes
2. **Indexes:** Strategic indexes on foreign keys and frequently queried columns
3. **Connection Pooling:** Up to 5 concurrent readers
4. **Batch Operations:** Support for inserting multiple actions at once
5. **Upsert Operations:** Single query for both insert and update

## Testing

### Unit Tests

Located in `GlideTests/RepositoryTests.swift`:

- `LocalNoteRepositoryTests` - Note CRUD operations
- `LocalFolderRepositoryTests` - Folder hierarchy operations
- `LocalActionRepositoryTests` - Action filtering operations
- `SyncQueueRepositoryTests` - Sync queue management

**Test Setup:**
```swift
// In-memory database for fast, isolated tests
let database = try TestDatabaseSetup.createInMemoryDatabase()
let repository = LocalNoteRepository(database: database)
```

### Running Tests

```bash
# Run all tests
swift test --package-path Glide

# Run specific test class
swift test --filter LocalNoteRepositoryTests
```

## Migration Strategy

### Current Version: 1

**Migration 1: Initial Schema**
- Created notes, folders, actions, sync_queue tables
- Added indexes for performance
- Enabled foreign key constraints

### Future Migrations

```swift
migrator.registerMigration("v2_add_search_index") { database in
    // Add full-text search index
    try database.create(virtualTable: "notes_fts", using: FTS4()) { t in
        t.synchronize(withTable: "notes")
        t.column("title")
        t.column("content")
    }
}
```

## Error Handling

### Database Errors

```swift
enum DatabaseError: LocalizedError {
    case notInitialized
    case fileDirectoryNotFound
    case migrationFailed(String)
    queryFailed(String)
}
```

### Best Practices

1. Always handle database errors gracefully
2. Use transactions for multi-step operations
3. Log errors for debugging
4. Show user-friendly messages for critical failures

## Thread Safety

- GRDB's `DatabaseQueue` provides thread-safe access
- Each thread gets a consistent database snapshot
- Writes are serialized to prevent corruption
- Concurrent reads are allowed (up to 5)

## Data Sync Strategy

### Offline-First Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. User creates note while offline                       │
│    → Note saved to SQLite immediately                    │
│    → Sync status set to "pending"                        │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Change queued in sync_queue table                     │
│    → Operation: "create"                                 │
│    → Entity: "note"                                      │
│    → Payload: Note data as JSON                          │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Network becomes available                             │
│    → Sync process checks sync_queue                      │
│    → Attempts to sync each entry                         │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Sync successful                                        │
│    → Note sent to server                                 │
│    → Server responds with confirmation                   │
│    → Entry removed from sync_queue                       │
│    → Note sync_status set to "synced"                    │
└──────────────────────────────────────────────────────────┘
```

## Future Enhancements

1. **Full-Text Search:** FTS5 virtual table for fast content search
2. **Data Encryption:** SQLCipher for encrypted database
3. **Cloud Backup:** Automatic database backup to iCloud
4. **Sync Optimization:** Differential sync to reduce bandwidth
5. **Conflict Resolution:** Automatic merge strategies
6. **Data Expiration:** Auto-delete old data to manage size

## References

- [GRDB.swift Documentation](https://github.com/groue/GRDB.swift)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Offline-First Architecture](https://www.instantlogic.com/portal/offline-first)

## Implementation Checklist

- ✅ Add GRDB.swift package dependency
- ✅ Create DatabaseManager service
- ✅ Define database schema migrations
- ✅ Create NoteRepository with CRUD operations
- ✅ Create FolderRepository with hierarchy support
- ✅ Create ActionRepository with note filtering
- ✅ Create SyncQueueRepository for offline changes
- ✅ Update DependencyContainer with database repositories
- ✅ Add database initialization to app launch
- ✅ Write unit tests for repository operations
