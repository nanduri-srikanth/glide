# Glide Backend API Reference

This document provides a comprehensive reference for the Glide backend API (FastAPI) for Swift developers implementing the macOS/iOS client.

**Base URL:** `http://localhost:8000/api/v1`

**Authentication:** Bearer Token (JWT) - Include `Authorization: Bearer <access_token>` header for authenticated requests.

---

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [Notes Endpoints](#notes-endpoints)
3. [Folders Endpoints](#folders-endpoints)
4. [Voice Endpoints](#voice-endpoints)
5. [Actions Endpoints](#actions-endpoints)
6. [Integrations Endpoints](#integrations-endpoints)
7. [Response Formats](#response-formats)
8. [Error Handling](#error-handling)

---

## Authentication Endpoints

### POST /auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
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
  "created_at": "2026-02-05T00:00:00Z"
}
```

### POST /auth/login

Login with email/password using OAuth2 password flow.

**Content-Type:** `application/x-www-form-urlencoded`

**Request Body:**
```
username=user@example.com&password=securepassword123
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### POST /auth/refresh

Refresh an expired access token using a refresh token.

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### GET /auth/me

Get current authenticated user profile.

**Response:**
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
  "created_at": "2026-02-05T00:00:00Z"
}
```

### PATCH /auth/me

Update current user profile.

**Request Body:**
```json
{
  "full_name": "John Updated Doe",
  "timezone": "America/New_York",
  "auto_transcribe": false,
  "auto_create_actions": true
}
```

**Response:** Same as GET /auth/me

### POST /auth/change-password

Change user password.

**Request Body:**
```json
{
  "current_password": "oldpassword",
  "new_password": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Password changed successfully",
  "request_id": "uuid-here"
}
```

### POST /auth/logout

Logout current user (invalidates tokens server-side).

**Response:**
```json
{
  "message": "Successfully logged out",
  "request_id": "uuid-here"
}
```

### POST /auth/apple

Sign in with Apple.

**Request Body:**
```json
{
  "identity_token": "apple-identity-token",
  "authorization_code": "apple-auth-code",
  "user_id": "apple-user-id",
  "email": "user@icloud.com",
  "full_name": "John Doe"
}
```

**Response:** Same as POST /auth/login

---

## Notes Endpoints

### GET /notes

List all notes with filtering, searching, and pagination.

**Query Parameters:**
- `folder_id` (UUID, optional) - Filter by folder
- `q` (string, optional) - Search in title and transcript
- `tags` (array of strings, optional) - Filter by tags (e.g., `tags=work&tags=meeting`)
- `is_pinned` (boolean, optional) - Filter pinned notes
- `is_archived` (boolean, optional) - Filter archived notes
- `page` (integer, default: 1) - Page number
- `per_page` (integer, default: 20, max: 100) - Items per page

**Response:**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Meeting Notes",
      "preview": "Discussion about project timeline...",
      "duration": 120,
      "folder_id": "folder-uuid",
      "folder_name": "Work",
      "tags": ["work", "meeting"],
      "is_pinned": true,
      "action_count": 2,
      "calendar_count": 1,
      "email_count": 0,
      "reminder_count": 1,
      "created_at": "2026-02-05T00:00:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "per_page": 20,
  "pages": 3
}
```

### GET /notes/search

Search notes (same as GET /notes with `q` parameter).

### GET /notes/search/all

Unified search across notes, folders, and actions.

**Query Parameters:**
- `q` (string, required) - Search query

**Response:**
```json
{
  "notes": [...],
  "folders": [...],
  "actions": [...]
}
```

### GET /notes/{note_id}

Get a single note by ID with all details including actions.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Meeting Notes",
  "transcript": "Full transcript text here...",
  "summary": "AI-generated summary...",
  "duration": 120,
  "audio_url": "https://storage.url/audio.mp3",
  "folder_id": "folder-uuid",
  "folder_name": "Work",
  "tags": ["work", "meeting"],
  "is_pinned": true,
  "is_archived": false,
  "ai_processed": true,
  "actions": [
    {
      "id": "action-uuid",
      "action_type": "calendar",
      "status": "pending",
      "priority": "high",
      "title": "Follow-up meeting",
      "description": "Schedule review meeting",
      "scheduled_date": "2026-02-10T14:00:00Z",
      "location": "Conference Room A",
      "attendees": ["john@example.com"],
      "created_at": "2026-02-05T00:00:00Z",
      "executed_at": null
    }
  ],
  "created_at": "2026-02-05T00:00:00Z",
  "updated_at": "2026-02-05T00:00:00Z"
}
```

### POST /notes

Create a new note.

**Request Body:**
```json
{
  "title": "New Note",
  "transcript": "Note content",
  "folder_id": "folder-uuid",
  "tags": ["tag1", "tag2"],
  "is_pinned": false
}
```

**Response:** Same as GET /notes/{note_id}

### PATCH /notes/{note_id}

Update an existing note.

**Request Body:**
```json
{
  "title": "Updated Title",
  "transcript": "Updated content",
  "folder_id": "new-folder-uuid",
  "tags": ["new", "tags"],
  "is_pinned": true,
  "is_archived": false
}
```

**Response:** Same as GET /notes/{note_id}

### DELETE /notes/{note_id}

Soft delete a note (marks as deleted, doesn't permanently remove).

**Response:** 204 No Content

### POST /notes/{note_id}/restore

Restore a soft-deleted note.

**Response:** Same as GET /notes/{note_id}

### POST /notes/{note_id}/auto-sort

Auto-assign folder based on AI classification.

**Response:** Same as GET /notes/{note_id}

---

## Folders Endpoints

### GET /folders

List all folders in hierarchical tree structure with note counts.

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Work",
    "icon": "💼",
    "color": "#3B82F6",
    "is_system": false,
    "sort_order": 0,
    "parent_id": null,
    "depth": 0,
    "note_count": 15,
    "children": [
      {
        "id": "child-uuid",
        "name": "Projects",
        "icon": "📁",
        "color": "#10B981",
        "is_system": false,
        "sort_order": 0,
        "parent_id": "550e8400-e29b-41d4-a716-446655440000",
        "depth": 1,
        "note_count": 5,
        "children": [],
        "created_at": "2026-02-05T00:00:00Z"
      }
    ],
    "created_at": "2026-02-05T00:00:00Z"
  }
]
```

### GET /folders/{folder_id}

Get a single folder by ID.

**Response:** Same as folder object in GET /folders

### POST /folders

Create a new folder.

**Request Body:**
```json
{
  "name": "New Folder",
  "icon": "📁",
  "color": "#3B82F6",
  "parent_id": "parent-folder-uuid"
}
```

**Response:** Same as GET /folders/{folder_id}

### PATCH /folders/{folder_id}

Update an existing folder.

**Request Body:**
```json
{
  "name": "Updated Name",
  "icon": "📂",
  "color": "#10B981",
  "parent_id": "new-parent-uuid"
}
```

**Response:** Same as GET /folders/{folder_id}

### DELETE /folders/{folder_id}

Delete a folder (notes are moved to parent or root).

**Response:** 204 No Content

### POST /folders/reorder

Bulk reorder folders (change sort_order).

**Request Body:**
```json
{
  "folders": [
    {
      "id": "folder-1-uuid",
      "sort_order": 0
    },
    {
      "id": "folder-2-uuid",
      "sort_order": 1
    }
  ]
}
```

**Response:**
```json
{
  "message": "Folders reordered successfully",
  "request_id": "uuid-here"
}
```

### POST /folders/setup-defaults

Create default system folders for a new user.

**Response:**
```json
{
  "message": "Default folders created",
  "folders": [...]
}
```

---

## Voice Endpoints

### POST /voice/process

Process a voice memo: upload audio, transcribe, and extract actions.

**Content-Type:** `multipart/form-data`

**Request Body:**
- `audio_file` (file, required) - Audio file (MP3, M4A, WAV, WebM)
- `folder_id` (UUID, optional) - Target folder

**Response:**
```json
{
  "note": {
    "id": "note-uuid",
    "title": "Voice Memo - Feb 5",
    "transcript": "Transcribed text...",
    "summary": "AI summary...",
    "duration": 120,
    "audio_url": "https://storage.url/audio.mp3",
    "folder_id": "folder-uuid",
    "tags": ["voice-memo"],
    "is_pinned": false,
    "is_archived": false,
    "ai_processed": true,
    "actions": [...],
    "created_at": "2026-02-05T00:00:00Z",
    "updated_at": "2026-02-05T00:00:00Z"
  },
  "actions_extracted": 3,
  "input_history": []
}
```

### POST /voice/transcribe

Transcribe audio file only (no action extraction).

**Request:** Same as /voice/process

**Response:**
```json
{
  "transcript": "Transcribed text...",
  "duration": 120
}
```

### POST /voice/analyze

Analyze text and extract actions (no audio).

**Request Body:**
```json
{
  "transcript": "Text to analyze..."
}
```

**Response:**
```json
{
  "summary": "AI summary...",
  "actions": [...]
}
```

### GET /voice/upload-url

Get pre-signed URL for direct audio upload to storage.

**Response:**
```json
{
  "upload_url": "https://storage.presigned.url",
  "storage_key": "audio/file/key.mp3"
}
```

---

## Actions Endpoints

### GET /actions

List all actions with optional filtering.

**Query Parameters:**
- `status` (string, optional) - Filter by status: pending, created, executed, failed, cancelled
- `action_type` (string, optional) - Filter by type: calendar, email, reminder, next_step

**Response:**
```json
[
  {
    "id": "action-uuid",
    "note_id": "note-uuid",
    "note_title": "Related Note",
    "action_type": "calendar",
    "status": "pending",
    "priority": "high",
    "title": "Meeting",
    "description": "Schedule follow-up",
    "scheduled_date": "2026-02-10T14:00:00Z",
    "location": "Room A",
    "attendees": ["john@example.com"],
    "created_at": "2026-02-05T00:00:00Z",
    "executed_at": null
  }
]
```

### GET /actions/{action_id}

Get a single action by ID.

**Response:** Same as action object in GET /actions

### PATCH /actions/{action_id}

Update an action.

**Request Body:**
```json
{
  "status": "completed",
  "priority": "medium",
  "scheduled_date": "2026-02-11T14:00:00Z"
}
```

**Response:** Same as GET /actions/{action_id}

### DELETE /actions/{action_id}

Delete an action.

**Response:** 204 No Content

### POST /actions/{action_id}/execute

Execute an action (create calendar event, send email, set reminder).

**Response:**
```json
{
  "action": {...},
  "external_id": "google-event-id",
  "external_url": "https://calendar.google.com/..."
}
```

### POST /actions/{action_id}/complete

Mark an action as completed.

**Response:** Same as GET /actions/{action_id}

---

## Integrations Endpoints

### GET /integrations/status

Get status of all integrations.

**Response:**
```json
{
  "google": {
    "connected": true,
    "calendars_enabled": true,
    "gmail_enabled": false
  },
  "apple": {
    "connected": false
  }
}
```

### GET /integrations/google/connect

Initiate Google OAuth flow.

**Response:** Redirects to Google OAuth consent screen

### GET /integrations/google/callback

OAuth callback for Google.

**Response:** Redirects to app with success/error

### DELETE /integrations/google

Disconnect Google integration.

**Response:**
```json
{
  "message": "Google disconnected successfully",
  "request_id": "uuid-here"
}
```

### POST /integrations/apple/connect

Connect Apple Sign-In / Apple integration.

**Request Body:**
```json
{
  "identity_token": "apple-token",
  "authorization_code": "apple-code",
  "user_id": "apple-user-id"
}
```

**Response:** Same as GET /integrations/status

### DELETE /integrations/apple

Disconnect Apple integration.

**Response:** Similar to Google disconnect

---

## Response Formats

### Success Response (Standard)

```json
{
  "data": { ... },
  "request_id": "uuid-here"
}
```

### Message Response

```json
{
  "message": "Operation successful",
  "request_id": "uuid-here"
}
```

---

## Error Handling

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  },
  "request_id": "uuid-here"
}
```

### Common Error Codes

- `AUTH_INVALID_TOKEN` - Invalid or expired JWT
- `AUTH_INVALID_CREDENTIALS` - Wrong email/password
- `AUTH_USER_EXISTS` - Email already registered
- `PERMISSION_DENIED` - Insufficient permissions
- `PERMISSION_ACCOUNT_INACTIVE` - Account disabled
- `VALIDATION_ERROR` - Invalid request data
- `NOT_FOUND` - Resource not found
- `CONFLICT` - Resource conflict (e.g., duplicate name)
- `EXTERNAL_SERVICE_ERROR` - Third-party service failure
- `RATE_LIMIT_EXCEEDED` - Too many requests

### HTTP Status Codes

- `200 OK` - Successful GET, PATCH
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource doesn't exist
- `409 Conflict` - Resource conflict
- `422 Unprocessable Entity` - Validation error
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - External service error

---

## Swift Codable Models

See `Glide/Glide/Models/API/` for Swift Codable models matching these response formats:

- `UserResponse.swift` - User, Token schemas
- `NoteModels.swift` - Note, NoteListResponse schemas
- `FolderModels.swift` - FolderResponse schemas
- `ActionModels.swift` - ActionResponse schemas
- `APIError.swift` - Error response schema

All models use `CodingKeys` for snake_case to camelCase conversion.
