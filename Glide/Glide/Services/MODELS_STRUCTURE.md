# Glide Models Structure

## File Organization

### `/Models/APIModels.swift`
**Purpose:** API request/response models that match the backend schemas

**Contains:**
- `UserResponse` - User data from API
- `NoteResponse` - Note data from API  
- `NoteCreateRequest` / `NoteUpdateRequest`
- `FolderResponse` - Folder data from API
- `FolderCreateRequest` / `FolderUpdateRequest`
- `ActionResponse` - Action data from API

**Used by:**
- Network layer (APIService)
- Repositories that talk to the API
- Conversion to/from local models

---

### `/Models/DatabaseModels.swift`
**Purpose:** Simple models for GRDB/SQLite database operations

**Contains:**
- `Note` - Database note record
- `Folder` - Database folder record
- `Action` - Database action record
- `ActionType` enum (nextStep, meeting, email, reminder, task, calendar)
- `ActionStatus` enum (pending, created, executed, completed, failed, cancelled)
- `ActionPriority` enum (low, medium, high)
- `FolderReorderItem` - Helper for folder reordering

**Used by:**
- `LocalNoteRepository.swift`
- `LocalFolderRepository.swift`
- `LocalActionRepository.swift`
- GRDB extensions (`FetchableRecord`, `PersistableRecord`)

**Note:** These extend to conform to GRDB protocols in their respective repository files

---

### `/Models/LocalModels.swift`
**Purpose:** Offline-first models with sync status

**Contains:**
- `SyncStatus` enum (synced, pending, conflict, error)
- `LocalNote` - `NoteResponse` + sync fields
- `LocalFolder` - `FolderResponse` + sync fields

**Used by:**
- Views (SwiftUI)
- Offline-first features
- Sync coordination

---

### `/Repositories/SyncQueueRepository.swift`
**Purpose:** Sync queue management

**Contains (in addition to repository class):**
- `SyncOperation` enum (create, update, delete)
- `SyncEntityType` enum (note, folder, action)
- `SyncQueueEntry` struct

**Why here:** These types are specific to sync queue operations and not used elsewhere

---

### `/Repositories/LocalFolderRepository.swift`
**Purpose:** Folder database operations with hierarchy

**Contains (in addition to repository class):**
- `FolderNode` struct - For hierarchical folder trees

**Why here:** Only used for folder hierarchy queries, specific to this repository

---

## Type Usage Guide

### When fetching from API:
```swift
// Use APIModels
let response: NoteResponse = try await apiService.get("/notes/\(id)")

// Convert to local model for offline support
let localNote = LocalNote(from: response, syncStatus: .synced)
```

### When saving to database:
```swift
// Create database model
let dbNote = Note(
    id: UUID().uuidString,
    title: "Title",
    content: "Content",
    ...
)

// Save using repository
try localNoteRepository.insert(dbNote)
```

### When displaying in views:
```swift
// Use LocalNote for offline-aware UI
struct NoteRow: View {
    let note: LocalNote
    
    var body: some View {
        HStack {
            Text(note.title)
            if note.syncStatus != .synced {
                Image(systemName: note.syncStatus.icon)
            }
        }
    }
}
```

### When syncing:
```swift
// Check sync queue
let pending = try syncQueueRepository.fetchRetryable()

for entry in pending {
    switch entry.entityType {
    case .note:
        // Sync note
        let note = try localNoteRepository.fetchById(entry.entityId)
        // Convert and upload...
    case .folder:
        // Sync folder...
    case .action:
        // Sync action...
    }
}
```

## Data Flow

```
┌─────────────────┐
│   API Server    │
└────────┬────────┘
         │
         │ NoteResponse, FolderResponse, ActionResponse
         ▼
┌─────────────────┐
│  APIModels.swift│
└────────┬────────┘
         │
         │ Convert to LocalNote/LocalFolder
         ▼
┌─────────────────┐
│LocalModels.swift│ ◄─── Used by SwiftUI Views
└────────┬────────┘
         │
         │ Save to database
         ▼
┌─────────────────┐
│DatabaseModels.  │ ◄─── Used by GRDB Repositories
│swift (Note,     │
│Folder, Action)  │
└────────┬────────┘
         │
         │ Track changes
         ▼
┌─────────────────┐
│ SyncQueueEntry  │ ◄─── Tracks what needs syncing
│(in SyncQueue    │
│Repository.swift)│
└─────────────────┘
```

## Common Issues & Solutions

### Issue: "Ambiguous type lookup"
**Cause:** Duplicate type definitions across files
**Solution:** Ensure each type is defined in ONLY ONE file:
- API types → `APIModels.swift`
- Database types → `DatabaseModels.swift`
- Local types → `LocalModels.swift`
- Sync types → `SyncQueueRepository.swift`
- Hierarchy types → `LocalFolderRepository.swift`

### Issue: "Type does not conform to Codable"
**Cause:** Missing Codable conformance or incomplete implementation
**Solution:** Ensure all stored properties are Codable

### Issue: "Cannot find type in scope"
**Cause:** Type not defined or not accessible
**Solution:** Add type to appropriate models file (all files in same target can access each other)

## Testing

Each model file should have corresponding tests:
- `APIModelsTests.swift` - Test JSON encoding/decoding
- `DatabaseModelsTests.swift` - Test GRDB operations
- `LocalModelsTests.swift` - Test conversions and computed properties

## Migration Checklist

When backend schema changes:
1. ✅ Update `APIModels.swift` to match backend
2. ✅ Update corresponding `DatabaseModels.swift` if needed
3. ✅ Update `LocalModels.swift` conversions
4. ✅ Update database migration if schema changed
5. ✅ Add tests for new fields
6. ✅ Update this documentation

## Best Practices

1. **Keep API models pure** - Match backend exactly, no computed properties for business logic
2. **Database models stay simple** - Just data storage, GRDB conformance added in repository files
3. **Local models add convenience** - Computed properties, UI helpers, conversion methods
4. **Don't mix concerns** - API models ≠ Database models ≠ Local models
5. **Use type conversions explicitly** - Makes data flow clear and maintainable
