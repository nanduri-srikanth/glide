//
//  ModelTests.swift
//  GlideTests
//
//  Created by Claude on 2/5/26.
//  Unit tests for API models to verify JSON decoding
//

import XCTest
@testable import Glide

// MARK: - User Model Tests

class UserModelTests: XCTestCase {

    func testUserResponseDecoding() throws {
        let json = """
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "email": "test@example.com",
            "full_name": "Test User",
            "is_active": true,
            "is_verified": true,
            "timezone": "America/Los_Angeles",
            "auto_transcribe": true,
            "auto_create_actions": true,
            "created_at": "2024-01-15T10:30:00Z",
            "google_connected": true,
            "apple_connected": false
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let user = try decoder.decode(UserResponse.self, from: json)

        XCTAssertEqual(user.email, "test@example.com")
        XCTAssertEqual(user.fullName, "Test User")
        XCTAssertTrue(user.isActive)
        XCTAssertTrue(user.isVerified)
        XCTAssertEqual(user.timezone, "America/Los_Angeles")
        XCTAssertTrue(user.autoTranscribe)
        XCTAssertTrue(user.autoCreateActions)
        XCTAssertTrue(user.googleConnected)
        XCTAssertFalse(user.appleConnected)
    }

    func testTokenDecoding() throws {
        let json = """
        {
            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "token_type": "bearer",
            "expires_in": 3600
        }
        """.data(using: .utf8)!

        let token = try JSONDecoder().decode(Token.self, from: json)

        XCTAssertFalse(token.accessToken.isEmpty)
        XCTAssertFalse(token.refreshToken.isEmpty)
        XCTAssertEqual(token.tokenType, "bearer")
        XCTAssertEqual(token.expiresIn, 3600)
    }
}

// MARK: - Action Model Tests

class ActionModelTests: XCTestCase {

    func testActionResponseDecoding() throws {
        let json = """
        {
            "id": "550e8400-e29b-41d4-a716-446655440001",
            "note_id": "550e8400-e29b-41d4-a716-446655440000",
            "action_type": "calendar",
            "status": "pending",
            "priority": "high",
            "title": "Team Meeting",
            "description": "Weekly sync",
            "scheduled_date": "2024-01-20T14:00:00Z",
            "scheduled_end_date": "2024-01-20T15:00:00Z",
            "location": "Conference Room A",
            "attendees": ["john@example.com", "jane@example.com"],
            "email_to": null,
            "email_subject": null,
            "email_body": null,
            "external_id": null,
            "external_service": null,
            "external_url": null,
            "created_at": "2024-01-15T10:30:00Z",
            "executed_at": null
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let action = try decoder.decode(ActionResponse.self, from: json)

        XCTAssertEqual(action.actionType, .calendar)
        XCTAssertEqual(action.status, .pending)
        XCTAssertEqual(action.priority, .high)
        XCTAssertEqual(action.title, "Team Meeting")
        XCTAssertEqual(action.location, "Conference Room A")
        XCTAssertEqual(action.attendees.count, 2)
        XCTAssertNil(action.executedAt)
    }

    func testActionTypeEnum() throws {
        XCTAssertEqual(ActionType.calendar.rawValue, "calendar")
        XCTAssertEqual(ActionType.email.rawValue, "email")
        XCTAssertEqual(ActionType.reminder.rawValue, "reminder")
        XCTAssertEqual(ActionType.nextStep.rawValue, "next_step")
    }
}

// MARK: - Note Model Tests

class NoteModelTests: XCTestCase {

    func testNoteResponseDecoding() throws {
        let json = """
        {
            "id": "550e8400-e29b-41d4-a716-446655440002",
            "title": "Meeting Notes",
            "transcript": "This is the transcript of the meeting...",
            "summary": "Meeting about Q1 roadmap",
            "duration": 180,
            "audio_url": "https://example.com/audio.mp3",
            "folder_id": "550e8400-e29b-41d4-a716-446655440003",
            "folder_name": "Work",
            "tags": ["meeting", "work"],
            "is_pinned": true,
            "is_archived": false,
            "ai_processed": true,
            "actions": [],
            "created_at": "2024-01-15T10:00:00Z",
            "updated_at": "2024-01-15T10:30:00Z"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let note = try decoder.decode(NoteResponse.self, from: json)

        XCTAssertEqual(note.title, "Meeting Notes")
        XCTAssertEqual(note.duration, 180)
        XCTAssertTrue(note.hasAudio)
        XCTAssertTrue(note.isPinned)
        XCTAssertFalse(note.isArchived)
        XCTAssertTrue(note.aiProcessed)
        XCTAssertEqual(note.tags.count, 2)
    }

    func testNoteListItemDecoding() throws {
        let json = """
        {
            "id": "550e8400-e29b-41d4-a716-446655440002",
            "title": "Meeting Notes",
            "preview": "This is the transcript...",
            "duration": 180,
            "folder_id": null,
            "tags": ["meeting"],
            "is_pinned": false,
            "action_count": 3,
            "calendar_count": 1,
            "email_count": 1,
            "reminder_count": 1,
            "created_at": "2024-01-15T10:00:00Z"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let item = try decoder.decode(NoteListItem.self, from: json)

        XCTAssertEqual(item.title, "Meeting Notes")
        XCTAssertEqual(item.actionCount, 3)
        XCTAssertEqual(item.totalActionCount, 3)
        XCTAssertNil(item.folderId)
    }
}

// MARK: - Folder Model Tests

class FolderModelTests: XCTestCase {

    func testFolderResponseDecoding() throws {
        let json = """
        {
            "id": "550e8400-e29b-41d4-a716-446655440003",
            "name": "Work",
            "icon": "briefcase.fill",
            "color": "#3B82F6",
            "is_system": false,
            "note_count": 5,
            "sort_order": 0,
            "parent_id": null,
            "depth": 0,
            "children": [],
            "created_at": "2024-01-15T10:00:00Z"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let folder = try decoder.decode(FolderResponse.self, from: json)

        XCTAssertEqual(folder.name, "Work")
        XCTAssertEqual(folder.icon, "briefcase.fill")
        XCTAssertEqual(folder.color, "#3B82F6")
        XCTAssertFalse(folder.isSystem)
        XCTAssertEqual(folder.noteCount, 5)
        XCTAssertTrue(folder.hasNotes)
    }
}

// MARK: - API Error Tests

class APIErrorTests: XCTestCase {

    func testAPIErrorResponseDecoding() throws {
        let json = """
        {
            "code": "VALIDATION_ERROR",
            "message": "Invalid input data",
            "details": {
                "suggestion": "Please check your input and try again"
            }
        }
        """.data(using: .utf8)!

        let error = try JSONDecoder().decode(APIErrorResponse.self, from: json)

        XCTAssertEqual(error.code, "VALIDATION_ERROR")
        XCTAssertEqual(error.message, "Invalid input data")
        XCTAssertTrue(error.isValidationError)
        XCTAssertFalse(error.isAuthError)
    }
}

// MARK: - Local Model Tests

class LocalModelTests: XCTestCase {

    func testLocalNoteInitialization() {
        let localNote = LocalNote.createLocal(
            title: "Local Note",
            transcript: "This is a local note",
            folderId: nil
        )

        XCTAssertEqual(localNote.title, "Local Note")
        XCTAssertTrue(localNote.isLocalOnly)
        XCTAssertEqual(localNote.syncStatus, .pending)
        XCTAssertTrue(localNote.hasLocalAudio)
        XCTAssertTrue(localNote.needsSync)
    }

    func testSyncStatusEnum() {
        XCTAssertEqual(SyncStatus.synced.rawValue, "synced")
        XCTAssertEqual(SyncStatus.pending.rawValue, "pending")
        XCTAssertEqual(SyncStatus.conflict.rawValue, "conflict")
        XCTAssertEqual(SyncStatus.error.rawValue, "error")

        XCTAssertTrue(SyncStatus.pending.needsSync)
        XCTAssertFalse(SyncStatus.synced.needsSync)
        XCTAssertTrue(SyncStatus.conflict.hasError)
    }
}

// MARK: - Generic Response Type Tests

class GenericResponseTests: XCTestCase {

    func testAPIResponseDecoding() throws {
        let json = """
        {
            "data": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "email": "test@example.com",
                "full_name": "Test User",
                "is_active": true,
                "is_verified": true,
                "timezone": "America/Los_Angeles",
                "auto_transcribe": true,
                "auto_create_actions": true,
                "created_at": "2024-01-15T10:30:00Z",
                "google_connected": true,
                "apple_connected": false
            },
            "message": "User retrieved successfully",
            "code": "SUCCESS"
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let response = try decoder.decode(APIResponse<UserResponse>.self, from: json)

        XCTAssertEqual(response.data.email, "test@example.com")
        XCTAssertEqual(response.message, "User retrieved successfully")
        XCTAssertEqual(response.code, "SUCCESS")
    }

    func testPaginatedResponseDecoding() throws {
        let json = """
        {
            "items": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440001",
                    "title": "Meeting Notes",
                    "preview": "This is the transcript...",
                    "duration": 180,
                    "folder_id": null,
                    "tags": ["meeting"],
                    "is_pinned": false,
                    "action_count": 3,
                    "calendar_count": 1,
                    "email_count": 1,
                    "reminder_count": 1,
                    "created_at": "2024-01-15T10:00:00Z"
                }
            ],
            "total": 25,
            "page": 1,
            "per_page": 20,
            "pages": 2
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let response = try decoder.decode(PaginatedResponse<NoteListItem>.self, from: json)

        XCTAssertEqual(response.items.count, 1)
        XCTAssertEqual(response.total, 25)
        XCTAssertEqual(response.page, 1)
        XCTAssertEqual(response.perPage, 20)
        XCTAssertEqual(response.pages, 2)
        XCTAssertTrue(response.hasMorePages)
        XCTAssertTrue(response.hasNextPage)
        XCTAssertFalse(response.hasPreviousPage)
        XCTAssertFalse(response.isLastPage)
    }

    func testPaginatedResponseLastPage() throws {
        let json = """
        {
            "items": [],
            "total": 25,
            "page": 2,
            "per_page": 20,
            "pages": 2
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder().decode(PaginatedResponse<NoteListItem>.self, from: json)

        XCTAssertTrue(response.isLastPage)
        XCTAssertFalse(response.hasMorePages)
        XCTAssertFalse(response.isFirstPage)
    }

    func testEmptyResponseDecoding() throws {
        let json = """
        {
            "message": "Resource deleted successfully",
            "code": "SUCCESS"
        }
        """.data(using: .utf8)!

        let response = try JSONDecoder().decode(EmptyResponse.self, from: json)

        XCTAssertEqual(response.message, "Resource deleted successfully")
        XCTAssertEqual(response.code, "SUCCESS")
    }

    func testBatchResponseDecoding() throws {
        let json = """
        {
            "succeeded": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440001",
                    "title": "Note 1"
                }
            ],
            "failed": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440002",
                    "error": "VALIDATION_ERROR",
                    "message": "Invalid title"
                }
            ],
            "total": 2,
            "success_count": 1,
            "failure_count": 1
        }
        """.data(using: .utf8)!

        // For this test, we'll use a simple Codable struct
        struct SimpleNote: Codable {
            let id: String
            let title: String
        }

        let response = try JSONDecoder().decode(BatchResponse<SimpleNote>.self, from: json)

        XCTAssertEqual(response.succeeded.count, 1)
        XCTAssertEqual(response.failed.count, 1)
        XCTAssertEqual(response.total, 2)
        XCTAssertEqual(response.successCount, 1)
        XCTAssertEqual(response.failureCount, 1)
        XCTAssertFalse(response.allSucceeded)
    }

    func testAPIResponseEncoding() throws {
        let user = UserResponse(
            id: UUID(),
            email: "test@example.com",
            fullName: "Test User",
            isActive: true,
            isVerified: true,
            timezone: "America/Los_Angeles",
            autoTranscribe: true,
            autoCreateActions: true,
            createdAt: Date(),
            googleConnected: true,
            appleConnected: false
        )

        let apiResponse = APIResponse(data: user, message: "Success", code: "SUCCESS")

        let encoder = JSONEncoder()
        let data = try encoder.encode(apiResponse)

        XCTAssertFalse(data.isEmpty)

        // Verify it can be round-tripped
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(APIResponse<UserResponse>.self, from: data)

        XCTAssertEqual(decoded.data.email, "test@example.com")
        XCTAssertEqual(decoded.message, "Success")
        XCTAssertEqual(decoded.code, "SUCCESS")
    }
}
