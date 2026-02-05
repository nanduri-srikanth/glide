# Glide Backend API Reference

**Version:** 1.0.0
**Base URL:** `https://api.glide.com/api/v1`
**Last Updated:** February 5, 2026

This reference document is for Swift developers integrating with the Glide FastAPI backend. All endpoints follow REST conventions and return standardized JSON responses.

---

## Table of Contents

- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Notes](#notes)
- [Folders](#folders)
- [Voice Processing](#voice-processing)
- [Actions](#actions)
- [Integrations](#integrations)

---

## Authentication

All API endpoints (except registration and login) require Bearer token authentication. Include the access token in the `Authorization` header:

```swift
var request = URLRequest(url: url)
request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
```

### Token Format

Access tokens are JWT tokens with the following structure:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 900
}
```

- `access_token`: JWT token for API requests (15-minute expiration)
- `refresh_token`: JWT token for obtaining new access tokens (7-day expiration)
- `token_type`: Always `"bearer"`
- `expires_in`: Access token lifetime in seconds (default: 900 = 15 minutes)

---

### POST /auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "full_name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "full_name": "John Doe",
  "is_active": true,
  "is_verified": false,
  "timezone": "UTC",
  "auto_transcribe": true,
  "auto_create_actions": true,
  "google_connected": false,
  "apple_connected": false,
  "created_at": "2026-02-05T10:30:00Z"
}
```

**Validation Rules:**
- `email`: Must be valid email format
- `password`: 8-100 characters required
- `full_name`: Optional, max 255 characters

---

### POST /auth/login

Authenticate with email/password and receive tokens.

**Request (OAuth2 Form):**
```
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=securePassword123
```

**Note:** Use `username` field for email (OAuth2 standard).

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 900
}
```

**Error (400 Bad Request):**
```json
{
  "error": {
    "code": "invalid_credentials",
    "message": "Incorrect email or password"
  },
  "request_id": "req_abc123",
  "timestamp": "2026-02-05T10:30:00Z"
}
```

---

### POST /auth/refresh

Obtain a new access token using a refresh token.

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 900
}
```

**Error (401 Unauthorized):**
```json
{
  "error": {
    "code": "invalid_refresh_token",
    "message": "Invalid or expired refresh token"
  },
  "request_id": "req_abc123",
  "timestamp": "2026-02-05T10:30:00Z"
}
```

---

### GET /auth/me

Get the current authenticated user's profile.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "full_name": "John Doe",
  "is_active": true,
  "is_verified": false,
  "timezone": "UTC",
  "auto_transcribe": true,
  "auto_create_actions": true,
  "google_connected": true,
  "apple_connected": false,
  "created_at": "2026-02-05T10:30:00Z"
}
```

---

### PATCH /auth/me

Update the current user's profile.

**Authentication:** Required

**Request Body:**
```json
{
  "full_name": "John Smith",
  "timezone": "America/New_York",
  "auto_transcribe": false,
  "auto_create_actions": true
}
```

All fields are optional. Only include fields you want to update.

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "full_name": "John Smith",
  "is_active": true,
  "is_verified": false,
  "timezone": "America/New_York",
  "auto_transcribe": false,
  "auto_create_actions": true,
  "google_connected": true,
  "apple_connected": false,
  "created_at": "2026-02-05T10:30:00Z"
}
```

---

### POST /auth/change-password

Change the user's password.

**Authentication:** Required

**Request Body:**
```json
{
  "current_password": "oldPassword123",
  "new_password": "newSecurePassword456"
}
```

**Response (200 OK):**
```json
{
  "message": "Password changed successfully",
  "request_id": "req_abc123"
}
```

---

### POST /auth/logout

Logout the current user (client should discard tokens).

**Authentication:** Required

**Response (200 OK):**
```json
{
  "message": "Successfully logged out",
  "request_id": "req_abc123"
}
```

**Note:** Tokens are stateless JWTs. Logout is a client-side operation of discarding tokens. In production, implement token blacklisting if needed.

---

### POST /auth/apple

Authenticate with Apple Sign-In.

**Request Body:**
```json
{
  "identity_token": "eyJhbGciOiJIUzI1NiIs...",
  "authorization_code": "c6f3c6f3c6f3c6f3",
  "user_id": "001234.abcd1234abcd1234",
  "email": "user@privaterelay.appleid.com",
  "full_name": "John Doe"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 900
}
```

**Note:** The server validates the `identity_token` with Apple's public keys. Creates a new user or signs in existing user by email.

---

## Error Handling

All errors follow a consistent format for programmatic handling.

### Standard Error Response

```json
{
  "error": {
    "code": "error_code",
    "message": "Human-readable error message",
    "param": "field_name",
    "details": ["Additional error details"]
  },
  "request_id": "req_abc123",
  "timestamp": "2026-02-05T10:30:00Z"
}
```

### Error Codes

#### Validation Errors (400)

| Code | Description |
|------|-------------|
| `validation_failed` | Request validation failed |
| `invalid_format` | Invalid data format |
| `missing_required_field` | Required field is missing |
| `invalid_value` | Invalid value provided |
| `invalid_audio_format` | Audio format not supported |
| `invalid_file_size` | File size exceeds limit |
| `invalid_credentials` | Incorrect email or password |
| `weak_password` | Password does not meet requirements |

#### Authentication Errors (401)

| Code | Description |
|------|-------------|
| `authentication_required` | Authentication token required |
| `invalid_auth_token` | Invalid or expired access token |
| `expired_auth_token` | Access token expired |
| `invalid_refresh_token` | Invalid or expired refresh token |
| `invalid_apple_token` | Apple identity token invalid |

#### Authorization Errors (403)

| Code | Description |
|------|-------------|
| `permission_denied` | User lacks permission |
| `resource_access_denied` | Cannot access this resource |
| `account_inactive` | User account is disabled |

#### Not Found Errors (404)

| Code | Description |
|------|-------------|
| `resource_not_found` | Generic resource not found |
| `user_not_found` | User not found |
| `note_not_found` | Note not found |
| `folder_not_found` | Folder not found |
| `action_not_found` | Action not found |
| `integration_not_found` | Integration not found |

#### Conflict Errors (409)

| Code | Description |
|------|-------------|
| `resource_already_exists` | Resource conflict |
| `email_already_registered` | Email already in use |
| `folder_already_exists` | Folder with this name exists |
| `action_already_executed` | Action already completed |

#### Rate Limiting Errors (429)

| Code | Description |
|------|-------------|
| `rate_limit_exceeded` | Rate limit exceeded |

#### External Service Errors (502/503)

| Code | Description |
|------|-------------|
| `transcription_service_failed` | Whisper transcription failed |
| `llm_service_failed` | Claude LLM processing failed |
| `storage_service_failed` | S3 storage upload failed |
| `google_service_failed` | Google API error |
| `apple_service_failed` | Apple API error |

---

## Notes

### GET /notes

List notes with filtering and pagination.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `folder_id` | UUID | No | Filter by folder |
| `q` | string | No | Search in title/transcript |
| `tags` | string[] | No | Filter by tags (comma-separated) |
| `is_pinned` | boolean | No | Filter by pinned status |
| `is_archived` | boolean | No | Filter by archived status (default: false) |
| `page` | integer | No | Page number (default: 1, min: 1) |
| `per_page` | integer | No | Items per page (default: 20, min: 1, max: 100) |

**Example Request:**
```
GET /api/v1/notes?folder_id=550e8400-...&q=meeting&page=1&per_page=20
```

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Meeting Notes: Project Kickoff",
      "preview": "Discussed project timeline, deliverables, and team roles...",
      "duration": 120,
      "folder_id": "660e8400-e29b-41d4-a716-446655440000",
      "tags": ["work", "meeting"],
      "is_pinned": true,
      "action_count": 3,
      "calendar_count": 1,
      "email_count": 1,
      "reminder_count": 1,
      "created_at": "2026-02-05T10:30:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "per_page": 20,
  "pages": 3
}
```

---

### GET /notes/search

Full-text search across notes.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `page` | integer | No | Page number (default: 1) |
| `per_page` | integer | No | Items per page (default: 20) |

**Response:** Same format as `GET /notes`

---

### GET /notes/search/all

Unified search across both folders and notes.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |

**Response (200 OK):**
```json
{
  "folders": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Work",
      "icon": "briefcase",
      "color": null,
      "is_system": false,
      "note_count": 12,
      "sort_order": 1,
      "parent_id": null,
      "depth": 0,
      "children": [],
      "created_at": "2026-02-01T10:00:00Z"
    }
  ],
  "notes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Meeting Notes",
      "preview": "Discussed project timeline...",
      "duration": 120,
      "folder_id": "660e8400-...",
      "tags": ["work"],
      "is_pinned": true,
      "action_count": 2,
      "calendar_count": 1,
      "email_count": 1,
      "reminder_count": 0,
      "created_at": "2026-02-05T10:30:00Z"
    }
  ]
}
```

---

### GET /notes/{note_id}

Get a single note with full details and actions.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note ID |

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Meeting Notes: Project Kickoff",
  "transcript": "Discussed the new project timeline with the team. We decided to launch on March 15th. John will handle the frontend, Sarah will work on the backend API.",
  "summary": "Project kickoff meeting covering timeline, roles, and next steps.",
  "duration": 120,
  "audio_url": "https://s3.amazonaws.com/...",
  "folder_id": "660e8400-e29b-41d4-a716-446655440000",
  "folder_name": "Work",
  "tags": ["work", "meeting", "project"],
  "is_pinned": true,
  "is_archived": false,
  "ai_processed": true,
  "actions": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "action_type": "calendar",
      "status": "pending",
      "priority": null,
      "title": "Project Launch Meeting",
      "scheduled_date": "2026-03-15T10:00:00Z",
      "location": "Conference Room A",
      "attendees": ["john@example.com", "sarah@example.com"],
      "created_at": "2026-02-05T10:30:00Z"
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "action_type": "email",
      "status": "pending",
      "priority": null,
      "title": "Email to team@company.com",
      "email_to": "team@company.com",
      "email_subject": "Project Kickoff Summary",
      "email_body": "Hi team, here's a summary of our kickoff meeting...",
      "created_at": "2026-02-05T10:30:00Z"
    },
    {
      "id": "990e8400-e29b-41d4-a716-446655440000",
      "action_type": "reminder",
      "status": "pending",
      "priority": "high",
      "title": "Follow up with John on frontend progress",
      "scheduled_date": "2026-02-07T09:00:00Z",
      "created_at": "2026-02-05T10:30:00Z"
    }
  ],
  "created_at": "2026-02-05T10:30:00Z",
  "updated_at": "2026-02-05T10:30:00Z"
}
```

---

### POST /notes

Create a new note manually (non-voice).

**Authentication:** Required

**Request Body:**
```json
{
  "title": "Quick Note",
  "transcript": "This is a manually created note.",
  "folder_id": "660e8400-e29b-41d4-a716-446655440000",
  "tags": ["personal"]
}
```

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Quick Note",
  "transcript": "This is a manually created note.",
  "summary": null,
  "duration": null,
  "audio_url": null,
  "folder_id": "660e8400-...",
  "folder_name": null,
  "tags": ["personal"],
  "is_pinned": false,
  "is_archived": false,
  "ai_processed": false,
  "actions": [],
  "created_at": "2026-02-05T10:30:00Z",
  "updated_at": "2026-02-05T10:30:00Z"
}
```

---

### PATCH /notes/{note_id}

Update an existing note.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note ID |

**Request Body:**
```json
{
  "title": "Updated Title",
  "transcript": "Updated transcript",
  "folder_id": "660e8400-...",
  "tags": ["work", "updated"],
  "is_pinned": true,
  "is_archived": false
}
```

All fields are optional.

**Response (200 OK):** Full note object (same format as `GET /notes/{note_id}`)

---

### DELETE /notes/{note_id}

Delete a note (soft delete by default).

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `permanent` | boolean | No | Permanently delete (default: false) |

**Response (204 No Content)**

---

### POST /notes/{note_id}/restore

Restore a soft-deleted note.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note ID |

**Response (200 OK):** Full note object

---

### POST /notes/{note_id}/auto-sort

Auto-sort a note to the best folder using AI.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note ID |

**Response (200 OK):** Updated note object with new `folder_id`

**Note:** The AI analyzes the note content and user's existing folders to determine the best folder. Creates a new folder if needed.

---

## Folders

### GET /folders

List all folders in hierarchical tree structure.

**Authentication:** Required

**Response (200 OK):**
```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "name": "All Notes",
    "icon": "folder",
    "color": null,
    "is_system": true,
    "note_count": 45,
    "sort_order": 0,
    "parent_id": null,
    "depth": 0,
    "children": [],
    "created_at": "2026-02-01T10:00:00Z"
  },
  {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Work",
    "icon": "briefcase",
    "color": "#3B82F6",
    "is_system": false,
    "note_count": 12,
    "sort_order": 1,
    "parent_id": null,
    "depth": 0,
    "children": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440000",
        "name": "Projects",
        "icon": "folder.fill",
        "color": null,
        "is_system": false,
        "note_count": 5,
        "sort_order": 0,
        "parent_id": "770e8400-...",
        "depth": 1,
        "children": [],
        "created_at": "2026-02-02T10:00:00Z"
      }
    ],
    "created_at": "2026-02-01T10:00:00Z"
  }
]
```

**Notes:**
- Folders are returned in hierarchical tree structure with nested `children` arrays
- System folders (like "All Notes") cannot be modified or deleted
- Maximum nesting depth is 2 levels (root → child → grandchild)

---

### GET /folders/{folder_id}

Get a single folder.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | UUID | Folder ID |

**Response (200 OK):**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "name": "Work",
  "icon": "briefcase",
  "color": "#3B82F6",
  "is_system": false,
  "note_count": 12,
  "sort_order": 1,
  "parent_id": null,
  "depth": 0,
  "children": [],
  "created_at": "2026-02-01T10:00:00Z"
}
```

---

### POST /folders

Create a new folder.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Personal",
  "icon": "person.fill",
  "color": "#10B981",
  "parent_id": "770e8400-e29b-41d4-a716-446655440000"
}
```

**Validation Rules:**
- `name`: Required, max 255 characters, must be unique per user
- `icon`: Optional, max 50 characters (SF Symbols format)
- `color`: Optional, hex color format (#RRGGBB)
- `parent_id`: Optional, must be existing user folder

**Response (201 Created):**
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440000",
  "name": "Personal",
  "icon": "person.fill",
  "color": "#10B981",
  "is_system": false,
  "note_count": 0,
  "sort_order": 2,
  "parent_id": null,
  "depth": 0,
  "children": [],
  "created_at": "2026-02-05T10:30:00Z"
}
```

---

### PATCH /folders/{folder_id}

Update a folder.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | UUID | Folder ID |

**Request Body:**
```json
{
  "name": "Updated Name",
  "icon": "star.fill",
  "color": "#F59E0B",
  "sort_order": 5,
  "parent_id": "770e8400-..."
}
```

All fields are optional. System folders cannot be modified.

**Response (200 OK):** Updated folder object

---

### POST /folders/reorder

Bulk reorder folders for drag-and-drop.

**Authentication:** Required

**Request Body:**
```json
{
  "folders": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "sort_order": 1,
      "parent_id": null
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "sort_order": 0,
      "parent_id": "770e8400-..."
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "message": "Folders reordered successfully"
}
```

**Notes:**
- System folders cannot be reordered
- Validates maximum nesting depth (2 levels)
- Prevents circular references

---

### DELETE /folders/{folder_id}

Delete a folder.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `folder_id` | UUID | Folder ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `move_notes_to` | UUID | No | Target folder ID for notes |

**Response (204 No Content)**

**Notes:**
- System folders cannot be deleted
- Notes are moved to `move_notes_to` folder or unassigned
- All child folders are also deleted

---

### POST /folders/setup-defaults

Create default folders for a new user.

**Authentication:** Required

**Response (200 OK):**
```json
{
  "message": "Folders setup complete",
  "created": 4
}
```

**Note:** Creates "All Notes" (system), "Work", "Personal", and "Ideas" folders if they don't exist.

---

## Voice Processing

### POST /voice/process

Process a voice memo: transcribe, extract actions, create note.

**Authentication:** Required

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio_file` | File | Yes | Audio file (mp3, m4a, wav) |
| `folder_id` | UUID | No | Target folder ID |

**Swift Implementation:**
```swift
let url = URL(string: "\(baseURL)/voice/process")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

let boundary = UUID().uuidString
request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

var body = Data()

// Add audio file
body.append("--\(boundary)\r\n".data(using: .utf8)!)
body.append("Content-Disposition: form-data; name=\"audio_file\"; filename=\"recording.m4a\"\r\n".data(using: .utf8)!)
body.append("Content-Type: audio/m4a\r\n\r\n".data(using: .utf8)!)
body.append(audioData)
body.append("\r\n".data(using: .utf8)!)

// Add folder_id if provided
if let folderId = folderId {
    body.append("--\(boundary)\r\n".data(using: .utf8)!)
    body.append("Content-Disposition: form-data; name=\"folder_id\"\r\n\r\n".data(using: .utf8)!)
    body.append("\(folderId)\r\n".data(using: .utf8)!)
}

body.append("--\(boundary)--\r\n".data(using: .utf8)!)
request.httpBody = body
```

**Response (200 OK):**
```json
{
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Meeting Notes: Project Planning",
  "transcript": "Discussed the quarterly roadmap with the team...",
  "summary": "Planning meeting covering Q2 roadmap and resource allocation",
  "duration": 180,
  "folder_id": "660e8400-e29b-41d4-a716-446655440000",
  "folder_name": "Work",
  "tags": ["meeting", "planning", "q2"],
  "actions": {
    "title": "Meeting Notes: Project Planning",
    "folder": "Work",
    "tags": ["meeting", "planning", "q2"],
    "summary": "Planning meeting covering Q2 roadmap...",
    "calendar": [
      {
        "title": "Q2 Planning Follow-up",
        "date": "2026-04-15",
        "time": "14:00",
        "location": "Conference Room B",
        "attendees": ["john@example.com", "sarah@example.com"]
      }
    ],
    "email": [
      {
        "to": "team@company.com",
        "subject": "Q2 Planning Notes",
        "body": "Hi team, here are the notes from our planning meeting..."
      }
    ],
    "reminders": [
      {
        "title": "Review Q2 budget proposal",
        "due_date": "2026-03-01",
        "due_time": "09:00",
        "priority": "high"
      }
    ],
    "next_steps": [
      "Create detailed project timeline",
      "Schedule stakeholder review meeting"
    ]
  },
  "created_at": "2026-02-05T10:30:00Z"
}
```

**Processing Flow:**
1. Upload audio to S3 storage
2. Transcribe using OpenAI Whisper
3. Extract actions using Claude LLM
4. Create or find folder (AI-suggested)
5. Create note with transcript and metadata
6. Create action records (calendar, email, reminders, next steps)

---

### POST /voice/synthesize

Synthesize a note from text and/or audio recording.

**Authentication:** Required

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text_input` | string | No* | Typed text content |
| `audio_file` | File | No* | Audio file (mp3, m4a, wav) |
| `folder_id` | UUID | No | Target folder ID |

*At least one of `text_input` or `audio_file` is required.

**Response (200 OK):**
```json
{
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Synthesized Note",
  "narrative": "Combined narrative from text and audio inputs...",
  "raw_inputs": [
    {
      "type": "text",
      "content": "Key point from text input",
      "timestamp": "2026-02-05T10:25:00Z",
      "duration": null,
      "audio_key": null
    },
    {
      "type": "audio",
      "content": "Transcribed audio content",
      "timestamp": "2026-02-05T10:30:00Z",
      "duration": 45,
      "audio_key": "user123/recording_abc123.mp3"
    }
  ],
  "summary": "Summary of synthesized content",
  "duration": 45,
  "folder_id": "660e8400-...",
  "folder_name": "Personal",
  "tags": ["synthesized", "mixed-input"],
  "actions": {
    "title": "Synthesized Note",
    "folder": "Personal",
    "tags": ["synthesized"],
    "summary": "Summary...",
    "calendar": [],
    "email": [],
    "reminders": [
      {
        "title": "Follow up on action items",
        "due_date": "2026-02-10",
        "due_time": "10:00",
        "priority": "medium"
      }
    ],
    "next_steps": []
  },
  "created_at": "2026-02-05T10:30:00Z",
  "updated_at": "2026-02-05T10:30:00Z"
}
```

**Features:**
- Combines text and audio into cohesive narrative
- Stores raw inputs in metadata for re-synthesis
- Extracts actions from combined content

---

### POST /voice/synthesize/{note_id}

Add new content to an existing note with smart synthesis.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Existing note ID |

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text_input` | string | No* | Additional text content |
| `audio_file` | File | No* | Additional audio file |
| `auto_decide` | boolean | No | AI decides append vs resynthesize (default: true) |
| `resynthesize` | boolean | No | Force resynthesize (true) or append (false) |

*At least one of `text_input` or `audio_file` is required.

**Response (200 OK):**
```json
{
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Updated Note Title",
  "narrative": "Synthesized narrative from all inputs...",
  "raw_inputs": [
    {
      "type": "audio",
      "content": "Original transcript",
      "timestamp": "2026-02-05T10:00:00Z",
      "duration": 60,
      "audio_key": "user123/original.mp3"
    },
    {
      "type": "text",
      "content": "Added text content",
      "timestamp": "2026-02-05T10:30:00Z",
      "duration": null,
      "audio_key": null
    }
  ],
  "summary": "Updated summary",
  "duration": 60,
  "folder_id": "660e8400-...",
  "folder_name": "Work",
  "tags": ["updated", "multi-input"],
  "actions": {
    "title": "Updated Note Title",
    "folder": "Work",
    "tags": ["updated"],
    "summary": "Updated summary...",
    "calendar": [],
    "email": [],
    "reminders": [],
    "next_steps": ["New action from added content"]
  },
  "created_at": "2026-02-05T10:00:00Z",
  "updated_at": "2026-02-05T10:30:00Z",
  "decision": {
    "update_type": "resynthesize",
    "confidence": 0.95,
    "reason": "New content significantly changes the context"
  }
}
```

**Decision Types:**
- `resynthesize`: Full re-synthesis from all inputs
- `append`: Smart append with new content summary

---

### POST /voice/resynthesize/{note_id}

Re-synthesize an existing note from its input history.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note ID |

**Response (200 OK):**
```json
{
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Freshly Synthesized Title",
  "narrative": "Comprehensive narrative from all inputs...",
  "raw_inputs": [...],
  "summary": "Updated summary",
  "duration": 120,
  "folder_id": "660e8400-...",
  "folder_name": "Personal",
  "tags": ["resynthesized"],
  "actions": { ... },
  "created_at": "2026-02-05T10:00:00Z",
  "updated_at": "2026-02-05T10:45:00Z"
}
```

**Use Case:** When user edits the note and wants AI to re-process with latest context.

---

### POST /voice/append/{note_id}

Append new audio to an existing note (legacy method).

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note ID |

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio_file` | File | Yes | Audio file (mp3, m4a, wav) |

**Response (200 OK):**
```json
{
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Original Title",
  "transcript": "Original transcript\n\n--- Added on Feb 5, 2026 at 10:30 AM ---\n\nAppended transcript",
  "summary": "Updated summary",
  "duration": 180,
  "folder_id": "660e8400-...",
  "folder_name": "Work",
  "tags": ["original", "appended"],
  "actions": {
    "title": "Original Title",
    "folder": "Work",
    "tags": ["original", "appended"],
    "summary": "Summary...",
    "calendar": [],
    "email": [],
    "reminders": [
      {
        "title": "New reminder from appended audio",
        "due_date": "2026-02-10",
        "due_time": "14:00",
        "priority": "medium"
      }
    ],
    "next_steps": []
  },
  "created_at": "2026-02-05T10:00:00Z"
}
```

**Note:** Only extracts NEW actions (context-aware, avoiding duplicates).

---

### POST /voice/transcribe

Transcribe audio without creating a note (for preview).

**Authentication:** Required

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio_file` | File | Yes | Audio file (mp3, m4a, wav) |

**Response (200 OK):**
```json
{
  "text": "Transcribed audio content",
  "language": "en",
  "duration": 45
}
```

---

### POST /voice/analyze

Analyze a transcript and extract actions (for preview).

**Authentication:** Required

**Request:** `application/x-www-form-urlencoded`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transcript` | string | Yes | Transcript text |

**Response (200 OK):** Action extraction object (same format as `actions` in `/voice/process`)

---

### GET /voice/upload-url

Get a presigned S3 URL for direct upload from mobile app.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filename` | string | Yes | Desired filename |
| `content_type` | string | No | MIME type (default: audio/mpeg) |

**Response (200 OK):**
```json
{
  "url": "https://s3.amazonaws.com/...",
  "key": "user123/recording_abc123.mp3",
  "fields": {
    "Content-Type": "audio/mpeg"
  }
}
```

**Usage:** Upload directly to S3 using the presigned URL, then call `/voice/process` with the `key`.

---

### DELETE /voice/notes/{note_id}/inputs/{input_index}

Delete a specific input from the note's input history.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note ID |
| `input_index` | integer | Index in input_history array |

**Response (200 OK):** Resynthesized note object

**Error (400 Bad Request):**
```json
{
  "error": {
    "code": "validation_failed",
    "message": "Cannot delete the last input. Use delete note instead.",
    "param": "input_index"
  }
}
```

---

## Actions

Action records are created automatically by voice processing. They represent actionable items extracted from notes.

### Action Types

| Type | Description |
|------|-------------|
| `calendar` | Calendar event |
| `email` | Email draft |
| `reminder` | Reminder with due date |
| `next_step` | Unstructured next step |

### Action Status

| Status | Description |
|--------|-------------|
| `pending` | Action not yet completed |
| `in_progress` | Action in progress |
| `completed` | Action completed |
| `cancelled` | Action cancelled |

### Action Priority (Reminders)

| Priority | Description |
|----------|-------------|
| `low` | Low priority |
| `medium` | Medium priority (default) |
| `high` | High priority |

Action endpoints are managed through the notes API. Actions are embedded in note objects and cannot be modified independently.

---

## Integrations

Integration endpoints connect with external services (Google Calendar, Apple Calendar, etc.).

### Available Integrations

- **Google Calendar**: Create events from calendar actions
- **Apple Calendar**: Create events from calendar actions (CalDAV)
- **Google Gmail**: Send email drafts
- **Apple Mail**: Send email drafts

**Note:** Integration endpoints are in active development. Refer to the integration router for the latest endpoints.

---

## Health & Status

### GET /

API root endpoint.

**Response (200 OK):**
```json
{
  "name": "Glide API",
  "version": "1.0.0",
  "status": "running",
  "docs": "/docs",
  "request_id": "req_abc123"
}
```

### GET /health

Health check for monitoring.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-02-05T10:30:00Z",
  "request_id": "req_abc123"
}
```

---

## Swift Implementation Tips

### URLSession Extension

```swift
struct GlideAPI {
    static let shared = GlideAPI()
    let baseURL = "https://api.glide.com/api/v1"
    private let accessToken: String

    init(accessToken: String) {
        self.accessToken = accessToken
    }

    func performRequest<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        body: Data? = nil,
        responseType: T.Type
    ) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body = body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode >= 400 {
            throw try decodeAPIError(data: data)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }

    private func decodeAPIError(data: Data) throws -> APIError {
        let errorResponse = try JSONDecoder().decode(GlideErrorResponse.self, from: data)
        return APIError.apiError(errorResponse.error)
    }
}

struct GlideErrorResponse: Decodable {
    let error: GlideError
    let requestId: String
    let timestamp: String
}

struct GlideError: Decodable {
    let code: String
    let message: String
    let param: String?
    let details: [String]?
}
```

### Token Refresh Flow

```swift
class TokenManager {
    private var accessToken: String
    private var refreshToken: String

    func getValidAccessToken() async throws -> String {
        // Check if token is expired
        if isTokenExpired(accessToken) {
            accessToken = try await refreshTokens()
        }
        return accessToken
    }

    private func refreshTokens() async throws -> String {
        let url = URL(string: "\(baseURL)/auth/refresh")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["refresh_token": refreshToken]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(TokenResponse.self, from: data)

        self.accessToken = response.access_token
        self.refreshToken = response.refresh_token

        return response.access_token
    }
}
```

---

## Support

For API support or questions, contact the backend team or refer to the inline code documentation in the FastAPI routers.

**API Documentation (Swagger):** `https://api.glide.com/docs`
**Interactive API (ReDoc):** `https://api.glide.com/redoc`
