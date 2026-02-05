# 🚀 Multi-Agent Task: Glide iOS API Integration - Phase 1 & 2

## Context
I'm working on a Swift iOS app (Glide) that needs to connect to an existing FastAPI backend. The backend is fully implemented in `glide-backend/` with comprehensive API documentation in `API_REFERENCE.md`. I need to build the Swift networking layer and data models.

## Project Structure
```
glide/
├── Glide/Glide/              # Swift iOS app (current work)
│   ├── Services/
│   ├── Models/
│   └── Views/
└── glide-backend/             # FastAPI backend (already done)
```

## Backend Info
- **Framework**: FastAPI (Python)
- **Base URL**: `http://localhost:8000/api/v1`
- **Database**: PostgreSQL/Supabase
- **Auth**: JWT Bearer tokens (access + refresh)
- **API Docs**: See `API_REFERENCE.md` in project root

## Files Already Exist
- ✅ `AuthService.swift` (has login, register, token refresh)
- ✅ `VoiceService.swift` (has multipart upload examples)
- ✅ `NotesRepository.swift` (basic CRUD, needs expansion)
- ✅ `FoldersRepository.swift` (basic CRUD, needs expansion)
- ✅ `UserRepository.swift` (basic)
- ✅ `DependencyContainer.swift` (has protocols defined)
- ✅ `SecurityService.swift` (current file)
- ✅ `DatabaseManager.swift` (local SQLite with GRDB)

---

## 🎯 Agent Tasks

### **Agent 1: Core API Service** (Priority: CRITICAL)
**File to create**: `Services/APIService.swift`

**Requirements**:
1. Implement `APIServiceProtocol` from `DependencyContainer.swift`
2. HTTP client using `URLSession` with async/await
3. Handle authentication headers (Bearer token from Keychain)
4. Automatic token refresh on 401 errors (call `authService.refreshTokenIfNeeded()`)
5. Generic request method: `func request<T: Decodable>(_ endpoint: String, method: HTTPMethod, body: Data?) async throws -> T`
6. Multipart upload method: `func upload(_ endpoint: String, data: Data, boundary: String) async throws`
7. Error mapping from backend error codes (see `API_REFERENCE.md` error codes section)
8. Request/response logging using `LoggerServiceProtocol`
9. Base URL from `Config.apiEndpoint`
10. Timeout configuration from `Config.Timeouts.defaultRequestTimeout`

**Reference files**:
- `VoiceService.swift` (has multipart upload example)
- `AuthService.swift` (shows token management pattern)
- `API_REFERENCE.md` (error codes and response formats)

---

### **Agent 2: Endpoint Definitions** (Priority: HIGH)
**File to create**: `Services/Endpoint.swift`

**Requirements**:
1. Create enum `Endpoint` with associated values
2. Map all routes from `API_REFERENCE.md`:
   - Auth: `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/change-password`, `/auth/apple`
   - Notes: `/notes`, `/notes/{id}`, `/notes/search`, `/notes/search/all`, `/notes/{id}/restore`, `/notes/{id}/auto-sort`
   - Voice: `/voice/process`, `/voice/transcribe`, `/voice/analyze`, `/voice/synthesize`, `/voice/synthesize/{id}`, `/voice/resynthesize/{id}`, `/voice/append/{id}`, `/voice/upload-url`
   - Folders: `/folders`, `/folders/{id}`, `/folders/reorder`, `/folders/setup-defaults`
3. Each case should have a computed `path` property returning the string path
4. Support query parameters with `URLComponents`
5. Type-safe enum for route parameters

**Example structure**:
```swift
enum Endpoint {
    case login
    case notes(page: Int?, perPage: Int?, folderId: String?)
    case note(id: String)
    case voiceProcess(folderId: String?)
    
    var path: String {
        // Implementation
    }
}
```

**Reference**: `API_REFERENCE.md` (complete endpoint list)

---

### **Agent 3: API Error Handling** (Priority: HIGH)
**File to create**: `Services/APIError.swift`

**Requirements**:
1. Create `enum APIError: LocalizedError`
2. Map all error codes from `API_REFERENCE.md` Error Handling section
3. Support for backend error response format:
   ```json
   {
     "error": {
       "code": "error_code",
       "message": "Human-readable message",
       "param": "field_name",
       "details": ["Additional errors"]
     },
     "request_id": "req_abc123",
     "timestamp": "2026-02-05T10:30:00Z"
   }
   ```
4. Decodable struct `BackendErrorResponse` for parsing
5. User-friendly `errorDescription` for each error type
6. HTTP status code to error mapping (400, 401, 403, 404, 409, 429, 500+)

**Error categories** (from API_REFERENCE.md):
- Validation (400): `validation_failed`, `invalid_format`, `missing_required_field`, etc.
- Authentication (401): `authentication_required`, `invalid_auth_token`, `expired_auth_token`
- Authorization (403): `permission_denied`, `account_inactive`
- Not Found (404): `resource_not_found`, `user_not_found`, `note_not_found`
- Conflict (409): `email_already_registered`, `folder_already_exists`
- Rate Limiting (429): `rate_limit_exceeded`
- Server (500+): `transcription_service_failed`, `llm_service_failed`, `storage_service_failed`

---

### **Agent 4: User Model** (Priority: HIGH)
**File to create**: `Models/API/User.swift`

**Requirements**:
1. Match backend response from `GET /auth/me` (see `API_REFERENCE.md`)
2. `Codable` struct with snake_case to camelCase mapping
3. Properties:
   - `id: String` (UUID)
   - `email: String`
   - `fullName: String` (`full_name`)
   - `isActive: Bool` (`is_active`)
   - `isVerified: Bool` (`is_verified`)
   - `timezone: String`
   - `autoTranscribe: Bool` (`auto_transcribe`)
   - `autoCreateActions: Bool` (`auto_create_actions`)
   - `googleConnected: Bool` (`google_connected`)
   - `appleConnected: Bool` (`apple_connected`)
   - `createdAt: Date` (`created_at`) - ISO 8601 format
4. Custom `CodingKeys` enum for snake_case mapping
5. Date decoding strategy: ISO 8601

**Reference**: `API_REFERENCE.md` - Auth section, `GET /auth/me` response

---

### **Agent 5: Note Model** (Priority: HIGH)
**File to create**: `Models/API/Note.swift`

**Requirements**:
1. Match backend response from `GET /notes/{note_id}` (see `API_REFERENCE.md`)
2. `Codable` struct with complete property mapping
3. Properties:
   - `id: String`
   - `title: String`
   - `transcript: String`
   - `summary: String?`
   - `duration: Int?` (seconds)
   - `audioUrl: String?` (`audio_url`)
   - `folderId: String?` (`folder_id`)
   - `folderName: String?` (`folder_name`)
   - `tags: [String]`
   - `isPinned: Bool` (`is_pinned`)
   - `isArchived: Bool` (`is_archived`)
   - `aiProcessed: Bool` (`ai_processed`)
   - `actions: [Action]` (nested array)
   - `createdAt: Date` (`created_at`)
   - `updatedAt: Date` (`updated_at`)
4. Also create `NoteListItem` for paginated list responses (preview only, no actions)
5. Create `NotesListResponse` wrapper:
   ```swift
   struct NotesListResponse: Codable {
       let items: [NoteListItem]
       let total: Int
       let page: Int
       let perPage: Int
       let pages: Int
   }
   ```

**Reference**: `API_REFERENCE.md` - Notes section

---

### **Agent 6: Folder Model** (Priority: HIGH)
**File to create**: `Models/API/Folder.swift`

**Requirements**:
1. Match backend response from `GET /folders` (see `API_REFERENCE.md`)
2. Recursive hierarchy support (folders can have nested `children`)
3. Properties:
   - `id: String`
   - `name: String`
   - `icon: String?` (SF Symbol name)
   - `color: String?` (hex format)
   - `isSystem: Bool` (`is_system`)
   - `noteCount: Int` (`note_count`)
   - `sortOrder: Int` (`sort_order`)
   - `parentId: String?` (`parent_id`)
   - `depth: Int`
   - `children: [Folder]` (recursive)
   - `createdAt: Date` (`created_at`)
4. Create `FolderReorderItem` for bulk reorder:
   ```swift
   struct FolderReorderItem: Codable {
       let id: String
       let sortOrder: Int
       let parentId: String?
   }
   ```
5. Create `FolderBulkReorder` wrapper for POST request

**Reference**: `API_REFERENCE.md` - Folders section

---

### **Agent 7: Action Model** (Priority: MEDIUM)
**File to create**: `Models/API/Action.swift`

**Requirements**:
1. Match backend action schema (embedded in notes)
2. Enums:
   ```swift
   enum ActionType: String, Codable {
       case calendar, email, reminder, nextStep = "next_step"
   }
   
   enum ActionStatus: String, Codable {
       case pending, inProgress = "in_progress", completed, cancelled
   }
   
   enum ActionPriority: String, Codable {
       case low, medium, high
   }
   ```
3. Main struct properties:
   - `id: String`
   - `noteId: String?` (`note_id`)
   - `actionType: ActionType` (`action_type`)
   - `status: ActionStatus`
   - `priority: ActionPriority?`
   - `title: String`
   - Calendar fields: `scheduledDate`, `location`, `attendees`
   - Email fields: `emailTo`, `emailSubject`, `emailBody`
   - `createdAt: Date` (`created_at`)
4. All optional fields should be `Optional` types

**Reference**: `API_REFERENCE.md` - Notes section (actions are nested in note responses)

---

### **Agent 8: Config Updates** (Priority: MEDIUM)
**File to update**: `Config.swift`

**Requirements**:
1. Add API configuration section:
   ```swift
   enum Config {
       static let apiEndpoint: String = {
           #if DEBUG
           return "http://localhost:8000/api/v1"
           #else
           return "https://api.glide.com/api/v1"
           #endif
       }()
       
       enum Timeouts {
           static let defaultRequestTimeout: TimeInterval = 30
           static let uploadTimeout: TimeInterval = 120
       }
       
       enum FeatureFlags {
           static let disableJailbreakDetection = false
           // Add other feature flags
       }
   }
   ```
2. Environment-based URL switching (DEBUG vs RELEASE)
3. Timeout configurations
4. Feature flags (referenced in `SecurityService.swift`)

---

## 📋 Coordination Requirements

### All Agents Must:
1. ✅ Use Swift 5.9+ async/await (NO callbacks or Combine)
2. ✅ Follow Apple naming conventions (camelCase properties, PascalCase types)
3. ✅ Add comprehensive documentation comments
4. ✅ Handle errors with proper `throws` declarations
5. ✅ Use `Codable` for all API models
6. ✅ Map snake_case (backend) to camelCase (Swift) using `CodingKeys`
7. ✅ ISO 8601 date parsing for all `Date` fields
8. ✅ Mark files with header: `// Created by Claude on 2/5/26`

### Dependencies Between Agents:
- **Agent 1** (APIService) can work independently
- **Agent 2** (Endpoint) can work independently
- **Agent 3** (APIError) can work independently
- **Agent 4-7** (Models) can work independently
- **Agent 8** (Config) should complete before Agent 1 tests

### Testing Validation:
Each agent should provide usage examples showing:
```swift
// Example usage
let apiService = APIService(baseURL: Config.apiEndpoint, timeout: Config.Timeouts.defaultRequestTimeout, logger: ConsoleLogger())

// Test request
let user: User = try await apiService.request(Endpoint.getMe.path, method: .get, body: nil)
```

---

## 📄 Reference Documents

**Essential reading for all agents**:
1. **`API_REFERENCE.md`** - Complete API specification
2. **`DependencyContainer.swift`** - Existing protocols and architecture
3. **`AuthService.swift`** - Token management patterns
4. **`VoiceService.swift`** - Multipart upload example

---

## 🎯 Success Criteria

When all agents complete:
- ✅ Swift app can make authenticated requests to FastAPI backend
- ✅ All API endpoints from `API_REFERENCE.md` are accessible
- ✅ Token refresh happens automatically on 401 errors
- ✅ Backend errors are properly decoded and displayed
- ✅ All models match backend Pydantic schemas
- ✅ Type-safe API with compile-time safety
- ✅ Ready for Phase 3: Expanding repositories and ViewModels

---

## 🚀 Kick-Off Instructions

Please coordinate with other agents to:
1. **Read** `API_REFERENCE.md` completely
2. **Review** existing service files for patterns
3. **Implement** your assigned file with full documentation
4. **Provide** usage examples and test cases
5. **Flag** any inconsistencies between backend API and Swift requirements

**Start now and report completion with:**
- ✅ File created/updated
- ✅ Key features implemented
- ✅ Usage example
- ⚠️ Any blockers or questions

Let's build a rock-solid API layer! 🎉
