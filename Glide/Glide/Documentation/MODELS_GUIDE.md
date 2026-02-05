# Glide iOS Models - Backend-Aligned Documentation

## Overview

This document describes the Swift models that exactly match the backend API Pydantic schemas. All models support Codable for JSON serialization/deserialization and use CodingKeys for snake_case to camelCase conversion.

**Backend Reference:** `glide-backend/app/schemas/`

## Model Structure

```
Models/
├── API/                      # Network response/request models
│   ├── UserModels.swift     # User, Token, auth requests
│   ├── ActionModels.swift   # Actions, enums
│   ├── NoteModels.swift     # Notes, lists, search
│   ├── FolderModels.swift   # Folders, hierarchy
│   └── APIError.swift       # Error responses
└── Local/                   # Offline extensions
    └── LocalModels.swift     # LocalNote, LocalFolder, SyncStatus
```

## User Models (`UserModels.swift`)

### UserResponse
Matches backend: `user_schemas.py:UserResponse`

```swift
struct UserResponse: Codable {
    let id: UUID
    let email: String
    let fullName: String?              // full_name
    let isActive: Bool                 // is_active
    let isVerified: Bool               // is_verified
    let timezone: String
    let autoTranscribe: Bool           // auto_transcribe
    let autoCreateActions: Bool        // auto_create_actions
    let createdAt: Date                // created_at

    // Integration status
    let googleConnected: Bool          // google_connected
    let appleConnected: Bool           // apple_connected
}
```

**Computed Properties:**
- `displayName`: Returns fullName or email
- `initials`: Extracts initials from display name

### Token
Matches backend: `user_schemas.py:Token`

```swift
struct Token: Codable {
    let accessToken: String            // access_token
    let refreshToken: String           // refresh_token
    let tokenType: String              // token_type
    let expiresIn: Int                 // expires_in

    var expirationDate: Date
    var isExpired: Bool
}
```

### Request Models
- `UserCreateRequest`: Registration
- `UserUpdateRequest`: Profile updates
- `PasswordChangeRequest`: Password changes
- `PasswordResetRequest`: Reset initiation
- `PasswordResetConfirmRequest`: Reset confirmation

## Action Models (`ActionModels.swift`)

### Enums

#### ActionType
Matches backend: `models/action.py:ActionType`

```swift
enum ActionType: String {
    case calendar
    case email
    case reminder
    case nextStep                      // next_step
}
```

#### ActionStatus
Matches backend: `models/action.py:ActionStatus`

```swift
enum ActionStatus: String {
    case pending
    case created
    case executed
    case failed
    case cancelled
}
```

#### ActionPriority
Matches backend: `models/action.py:ActionPriority`

```swift
enum ActionPriority: String {
    case low
    case medium
    case high
}
```

**Note:** Backend has these as Python Enums, Swift mirrors them exactly.

### ActionResponse
Matches backend: `action_schemas.py:ActionResponse`

```swift
struct ActionResponse: Codable {
    let id: UUID
    let noteId: UUID                   // note_id
    let actionType: ActionType         // action_type
    let status: ActionStatus
    let priority: ActionPriority
    let title: String
    let description: String?

    // Calendar-specific
    let scheduledDate: Date?           // scheduled_date
    let scheduledEndDate: Date?        // scheduled_end_date
    let location: String?
    let attendees: [String]

    // Email-specific
    let emailTo: String?               // email_to
    let emailSubject: String?          // email_subject
    let emailBody: String?             // email_body

    // External integration
    let externalId: String?            // external_id
    let externalService: String?       // external_service
    let externalUrl: String?           // external_url

    let createdAt: Date                // created_at
    let executedAt: Date?              // executed_at
}
```

**Computed Properties:**
- `isPending`: True if status is pending or created
- `isCompleted`: True if status is executed
- `isFailed`: True if status is failed or cancelled
- `hasExternalLink`: True if externalUrl exists

### Create Request Models

All follow the pattern from `action_schemas.py`:

- `ActionCreateRequest`: Base fields
- `CalendarActionCreateRequest`: Calendar events
- `EmailActionCreateRequest`: Email drafts
- `ReminderActionCreateRequest`: Reminders
- `NextStepCreateRequest`: Next steps

### Other Action Models
- `ActionUpdateRequest`: Updates
- `ActionExecuteRequest`: Execution trigger
- `ActionExecuteResponse`: Execution result

## Note Models (`NoteModels.swift`)

### NoteResponse
Matches backend: `note_schemas.py:NoteResponse`

```swift
struct NoteResponse: Codable {
    let id: UUID
    let title: String
    let transcript: String
    let summary: String?
    let duration: Int?                 // Seconds
    let audioUrl: String?              // audio_url
    let folderId: UUID?                // folder_id
    let folderName: String?            // folder_name
    let tags: [String]
    let isPinned: Bool                 // is_pinned
    let isArchived: Bool               // is_archived
    let aiProcessed: Bool              // ai_processed
    let actions: [ActionResponse]
    let createdAt: Date                // created_at
    let updatedAt: Date                // updated_at
}
```

**Computed Properties:**
- `excerpt`: First 100 chars of transcript
- `wordCount`: Word count of transcript
- `readingTime`: Estimated reading time
- `hasAudio`: True if audioUrl exists
- `hasFolder`: True if folderId exists
- `hasActions`: True if actions array not empty
- `pendingActionCount`: Count of pending actions

### NoteListItem
Matches backend: `note_schemas.py:NoteListItem`

Optimized for list views, minimal data:

```swift
struct NoteListItem: Codable {
    let id: UUID
    let title: String
    let preview: String                // First 100 chars
    let duration: Int?
    let folderId: UUID?
    let tags: [String]
    let isPinned: Bool
    let actionCount: Int               // action_count
    let calendarCount: Int             // calendar_count
    let emailCount: Int                // email_count
    let reminderCount: Int             // reminder_count
    let createdAt: Date
}
```

**Computed Properties:**
- `hasActions`: actionCount > 0
- `totalActionCount`: Sum of all type counts
- `hasFolder`: folderId != nil
- `hasDuration`: duration > 0
- `durationFormatted`: Human-readable duration (e.g., "3m 20s")

### NoteListResponse
Matches backend: `note_schemas.py:NoteListResponse`

```swift
struct NoteListResponse: Codable {
    let items: [NoteListItem]
    let total: Int
    let page: Int
    let perPage: Int                   // per_page
    let pages: Int
}
```

**Computed Properties:**
- `hasMorePages`: page < pages
- `isLastPage`: page >= pages
- `isFirstPage`: page == 1

### Other Note Models
- `NoteCreateRequest`: Create new note
- `NoteUpdateRequest`: Update existing note
- `NoteSearchParams`: Search with filters
- `UnifiedSearchResponse`: Combined search results

## Folder Models (`FolderModels.swift`)

### FolderResponse
Matches backend: `note_schemas.py:FolderResponse`

```swift
struct FolderResponse: Codable {
    let id: UUID
    let name: String
    let icon: String                   // SF Symbol name
    let color: String?                 // Hex color
    let isSystem: Bool                 // is_system
    let noteCount: Int                 // note_count
    let sortOrder: Int                 // sort_order
    let parentId: UUID?                // parent_id
    let depth: Int
    let children: [FolderResponse]     // Recursive
    let createdAt: Date                // created_at
}
```

**Computed Properties:**
- `hasNotes`: noteCount > 0
- `hasChildren`: children array not empty
- `hasColor`: color exists and not empty
- `sfSymbolName`: Returns icon or default
- `folderColor`: Color from hex string
- `displayPath`: Full path string

**Methods:**
- `allDescendants()`: Recursively get all children
- `findChild(id:)`: Search for child by ID

### Other Folder Models
- `FolderCreateRequest`: Create new folder
- `FolderUpdateRequest`: Update folder
- `FolderReorderItem`: Single reorder item
- `FolderBulkReorder`: Bulk reorder operation

## API Error (`APIError.swift`)

### APIErrorResponse
Standard error response format:

```swift
struct APIErrorResponse: Codable {
    let code: String                   // Error code
    let message: String                // User-facing message
    let details: [String: String]?     // Additional details
}
```

### Error Codes
Defined in `APIErrorCode` enum:

**Network Errors:**
- `NETWORK_ERROR`
- `TIMEOUT`
- `NO_CONNECTION`

**Auth Errors:**
- `UNAUTHORIZED`
- `INVALID_TOKEN`
- `TOKEN_EXPIRED`
- `INVALID_CREDENTIALS`

**Validation Errors:**
- `VALIDATION_ERROR`
- `INVALID_INPUT`
- `MISSING_FIELD`

**Resource Errors:**
- `NOT_FOUND`
- `ALREADY_EXISTS`
- `CONFLICT`

**Server Errors:**
- `SERVER_ERROR`
- `SERVICE_UNAVAILABLE`
- `RATE_LIMITED`

**Permission Errors:**
- `FORBIDDEN`
- `INSUFFICIENT_PERMISSIONS`

## Local Models (`LocalModels.swift`)

### SyncStatus
Enum for offline sync state:

```swift
enum SyncStatus: String {
    case synced                        // Up to date with server
    case pending                       // Awaiting sync
    case conflict                      // Server has newer version
    case error                         // Sync failed
}
```

**Computed Properties:**
- `needsSync`: true if not synced
- `hasError`: true if conflict or error

**UI Helpers:**
- `displayName`: Human-readable
- `icon`: SF Symbol name
- `color`: SwiftUI Color

### LocalNote
Extends `NoteResponse` with local-only fields:

```swift
struct LocalNote: Codable {
    // All NoteResponse fields...

    // Local-only fields:
    var localAudioPath: String?        // Path to local audio file
    var syncStatus: SyncStatus         // Current sync state
    var syncError: String?             // Error message if sync failed
    var lastSyncAttempt: Date?         // Last sync timestamp
}
```

**Computed Properties:**
- `isLocalOnly`: Created locally, never synced
- `hasLocalAudio`: Local audio file exists
- `needsSync`: syncStatus.needsSync
- `hasSyncError`: syncStatus.hasError

**Initializers:**
- `init(from: NoteResponse, ...)`: Create from API response
- `toCreateRequest()`: Convert to create request
- `toUpdateRequest()`: Convert to update request

**Factory:**
- `createLocal(title:transcript:folderId:)`: Create new local note

### LocalFolder
Extends `FolderResponse` with local-only fields:

```swift
struct LocalFolder: Codable {
    // All FolderResponse fields...

    // Local-only fields:
    var syncStatus: SyncStatus
    var syncError: String?
    var lastSyncAttempt: Date?
    var isLocalDeleted: Bool           // Marked for deletion
}
```

## Date Handling

All date fields use `ISO8601` format with fractional seconds.

**Decoder Configuration:**
```swift
let decoder = JSONDecoder()
decoder.dateDecodingStrategy = .iso8601
```

**Encoder Configuration:**
```swift
let encoder = JSONEncoder()
encoder.dateEncodingStrategy = .iso8601
```

## UUID Handling

All ID fields are `UUID` type, which automatically handles:
- Decoding from string format: "550e8400-e29b-41d4-a716-446655440000"
- Encoding to string format
- Validation

## Coding Keys Pattern

All models use CodingKeys to convert between snake_case (backend) and camelCase (Swift):

```swift
enum CodingKeys: String, CodingKey {
    case audioUrl = "audio_url"
    case folderId = "folder_id"
    case createdAt = "created_at"
    // etc...
}
```

This ensures exact compatibility with the Pydantic schemas.

## Testing

Unit tests are provided in `GlideTests/ModelTests.swift` covering:

- ✅ JSON decoding from backend format
- ✅ Enum values match backend enums
- ✅ Computed properties work correctly
- ✅ Local model initialization
- ✅ Error response decoding

**To Run Tests:**
```bash
xcodebuild test -project Glide/Glide.xcodeproj -scheme Glide -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Mock Data

All models include `#if DEBUG` mock data for development:

```swift
#if DEBUG
extension UserResponse {
    static let mock = UserResponse(...)
}
#endif
```

**Usage in Views:**
```swift
#if DEBUG
Text(NoteResponse.mock.title)
#endif
```

## Usage Examples

### Decoding API Response

```swift
let decoder = JSONDecoder()
decoder.dateDecodingStrategy = .iso8601

let userResponse = try decoder.decode(UserResponse.self, from: data)
```

### Encoding Request

```swift
let encoder = JSONEncoder()
encoder.dateEncodingStrategy = .iso8601

let request = NoteCreateRequest(
    title: "My Note",
    transcript: "Content here...",
    folderId: nil,
    tags: []
)

let data = try encoder.encode(request)
```

### Working with Local Models

```swift
// Create from API response
let localNote = LocalNote(
    from: noteResponse,
    localAudioPath: "/path/to/audio.m4a",
    syncStatus: .synced
)

// Modify
localNote.title = "Updated Title"
localNote.syncStatus = .pending

// Convert back to request for syncing
let updateRequest = localNote.toUpdateRequest()
```

## Backend Schema Reference

For exact field definitions, refer to:

- `glide-backend/app/schemas/user_schemas.py`
- `glide-backend/app/schemas/note_schemas.py`
- `glide-backend/app/schemas/action_schemas.py`
- `glide-backend/app/models/action.py` (enums)

## Migration Notes

When backend schemas change:

1. Update the corresponding Swift model
2. Update CodingKeys if fields renamed
3. Add new fields at the end
4. Update mock data
5. Add unit test for new field
6. Update this documentation

## Best Practices

1. **Always use API models for network layer**
2. **Convert to Local models for offline support**
3. **Use computed properties for derived data**
4. **Keep CodingKeys updated**
5. **Add mock data for all models**
6. **Write tests for new models**
7. **Document complex computed properties**
8. **Use #if DEBUG for development helpers**

## Future Enhancements

- [ ] Add Core Data models for persistence
- [ ] Implement sync conflict resolution
- [ ] Add model validation methods
- [ ] Create diff utilities for sync
- [ ] Add model transformers (API → Local)
- [ ] Implement partial sync strategies
