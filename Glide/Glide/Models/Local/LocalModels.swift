//
//  LocalModels.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Local models for offline support with sync status
//

import Foundation
import SwiftUI

// MARK: - Sync Status

enum SyncStatus: String, Codable, CaseIterable {
    case synced
    case pending
    case conflict
    case error

    var displayName: String {
        switch self {
        case .synced: return "Synced"
        case .pending: return "Pending"
        case .conflict: return "Conflict"
        case .error: return "Error"
        }
    }

    var icon: String {
        switch self {
        case .synced: return "checkmark.circle.fill"
        case .pending: return "clock"
        case .conflict: return "exclamationmark.triangle.fill"
        case .error: return "xmark.circle.fill"
        }
    }

    var color: Color {
        switch self {
        case .synced: return .green
        case .pending: return .orange
        case .conflict: return .yellow
        case .error: return .red
        }
    }

    var needsSync: Bool {
        self != .synced
    }

    var hasError: Bool {
        self == .error || self == .conflict
    }
}

// MARK: - Local Note

struct LocalNote: Codable, Identifiable, Equatable {
    // API fields
    let id: UUID
    var title: String
    var transcript: String
    var summary: String?
    var duration: Int?
    var audioUrl: String?
    var folderId: UUID?
    var folderName: String?
    var tags: [String]
    var isPinned: Bool
    var isArchived: Bool
    var aiProcessed: Bool
    var actions: [ActionResponse]
    var createdAt: Date
    var updatedAt: Date

    // Local-only fields
    var localAudioPath: String?
    var syncStatus: SyncStatus
    var syncError: String?
    var lastSyncAttempt: Date?

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        // API fields
        case id
        case title
        case transcript
        case summary
        case duration
        case audioUrl = "audio_url"
        case folderId = "folder_id"
        case folderName = "folder_name"
        case tags
        case isPinned = "is_pinned"
        case isArchived = "is_archived"
        case aiProcessed = "ai_processed"
        case actions
        case createdAt = "created_at"
        case updatedAt = "updated_at"

        // Local fields
        case localAudioPath = "local_audio_path"
        case syncStatus = "sync_status"
        case syncError = "sync_error"
        case lastSyncAttempt = "last_sync_attempt"
    }

    // MARK: - Computed Properties

    var isLocalOnly: Bool {
        syncStatus == .pending && createdAt == updatedAt
    }

    var hasLocalAudio: Bool {
        localAudioPath != nil && !localAudioPath!.isEmpty
    }

    var needsSync: Bool {
        syncStatus.needsSync
    }

    var hasSyncError: Bool {
        syncStatus.hasError
    }

    // MARK: - Initialization from API Response

    init(from response: NoteResponse, localAudioPath: String? = nil, syncStatus: SyncStatus = .synced) {
        self.id = response.id
        self.title = response.title
        self.transcript = response.transcript
        self.summary = response.summary
        self.duration = response.duration
        self.audioUrl = response.audioUrl
        self.folderId = response.folderId
        self.folderName = response.folderName
        self.tags = response.tags
        self.isPinned = response.isPinned
        self.isArchived = response.isArchived
        self.aiProcessed = response.aiProcessed
        self.actions = response.actions
        self.createdAt = response.createdAt
        self.updatedAt = response.updatedAt
        self.localAudioPath = localAudioPath
        self.syncStatus = syncStatus
        self.syncError = nil
        self.lastSyncAttempt = nil
    }

    // MARK: - Convert to API Request

    func toCreateRequest() -> NoteCreateRequest {
        return NoteCreateRequest(
            title: title,
            transcript: transcript,
            folderId: folderId,
            tags: tags
        )
    }

    func toUpdateRequest() -> NoteUpdateRequest {
        return NoteUpdateRequest(
            title: title,
            transcript: transcript,
            folderId: folderId,
            tags: tags,
            isPinned: isPinned,
            isArchived: isArchived
        )
    }

    // MARK: - Equatable

    static func == (lhs: LocalNote, rhs: LocalNote) -> Bool {
        lhs.id == rhs.id && lhs.updatedAt == rhs.updatedAt
    }
}

// MARK: - Local Folder

struct LocalFolder: Codable, Identifiable, Equatable {
    // API fields
    let id: UUID
    var name: String
    var icon: String
    var color: String?
    var isSystem: Bool
    var noteCount: Int
    var sortOrder: Int
    var parentId: UUID?
    var depth: Int
    var children: [LocalFolder]
    var createdAt: Date

    // Local-only fields
    var syncStatus: SyncStatus
    var syncError: String?
    var lastSyncAttempt: Date?
    var isLocalDeleted: Bool

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        // API fields
        case id
        case name
        case icon
        case color
        case isSystem = "is_system"
        case noteCount = "note_count"
        case sortOrder = "sort_order"
        case parentId = "parent_id"
        case depth
        case children
        case createdAt = "created_at"

        // Local fields
        case syncStatus = "sync_status"
        case syncError = "sync_error"
        case lastSyncAttempt = "last_sync_attempt"
        case isLocalDeleted = "is_local_deleted"
    }

    // MARK: - Initialization from API Response

    init(from response: FolderResponse, syncStatus: SyncStatus = .synced) {
        self.id = response.id
        self.name = response.name
        self.icon = response.icon
        self.color = response.color
        self.isSystem = response.isSystem
        self.noteCount = response.noteCount
        self.sortOrder = response.sortOrder
        self.parentId = response.parentId
        self.depth = response.depth
        self.children = response.children.map { LocalFolder(from: $0, syncStatus: syncStatus) }
        self.createdAt = response.createdAt
        self.syncStatus = syncStatus
        self.syncError = nil
        self.lastSyncAttempt = nil
        self.isLocalDeleted = false
    }

    // MARK: - Convert to API Request

    func toCreateRequest() -> FolderCreateRequest {
        return FolderCreateRequest(
            name: name,
            icon: icon,
            color: color,
            parentId: parentId
        )
    }

    func toUpdateRequest() -> FolderUpdateRequest {
        return FolderUpdateRequest(
            name: name,
            icon: icon,
            color: color,
            sortOrder: sortOrder,
            parentId: parentId
        )
    }

    // MARK: - Equatable

    static func == (lhs: LocalFolder, rhs: LocalFolder) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Mock Data for Testing

#if DEBUG
extension LocalNote {
    static let mockSynced = LocalNote(
        from: NoteResponse.mock,
        syncStatus: .synced
    )

    static let mockPending = LocalNote(
        from: NoteResponse.mock,
        localAudioPath: "/path/to/local/audio.m4a",
        syncStatus: .pending
    )

    static let mockConflict = LocalNote(
        from: NoteResponse.mock,
        syncStatus: .conflict
    )

    static func createLocal(title: String, transcript: String, folderId: UUID? = nil) -> LocalNote {
        let now = Date()
        return LocalNote(
            id: UUID(),
            title: title,
            transcript: transcript,
            summary: nil,
            duration: nil,
            audioUrl: nil,
            folderId: folderId,
            folderName: nil,
            tags: [],
            isPinned: false,
            isArchived: false,
            aiProcessed: false,
            actions: [],
            createdAt: now,
            updatedAt: now,
            localAudioPath: "/path/to/audio.m4a",
            syncStatus: .pending,
            syncError: nil,
            lastSyncAttempt: nil
        )
    }
}

extension LocalFolder {
    static let mockSynced = LocalFolder(
        from: FolderResponse.mock,
        syncStatus: .synced
    )

    static func createLocal(name: String, icon: String = "folder.fill", color: String? = nil) -> LocalFolder {
        let now = Date()
        return LocalFolder(
            id: UUID(),
            name: name,
            icon: icon,
            color: color,
            isSystem: false,
            noteCount: 0,
            sortOrder: 0,
            parentId: nil,
            depth: 0,
            children: [],
            createdAt: now,
            syncStatus: .pending,
            syncError: nil,
            lastSyncAttempt: nil,
            isLocalDeleted: false
        )
    }
}
#endif
