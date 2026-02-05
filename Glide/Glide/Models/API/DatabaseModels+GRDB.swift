//
//  DatabaseModels+GRDB.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Database-specific models with GRDB conformances
//

import Foundation
import GRDB

// MARK: - Database Note Model

/// Database representation of a Note (matches SQLite schema)
struct DBNote: Codable, FetchableRecord, PersistableRecord {
    var id: String
    var title: String
    var content: String  // Note: database uses "content", API uses "transcript"
    var folderId: String?
    var tags: String  // JSON string
    var isPinned: Bool
    var isArchived: Bool
    var isDeleted: Bool
    var createdAt: Date
    var updatedAt: Date
    var syncedAt: Date?
    var syncStatus: String
    var syncError: String?
    var localAudioPath: String?
    
    // MARK: - Table Name
    
    static let databaseTableName = "notes"
    
    // MARK: - Coding Keys
    
    enum CodingKeys: String, CodingKey {
        case id
        case title
        case content
        case folderId = "folder_id"
        case tags
        case isPinned = "is_pinned"
        case isArchived = "is_archived"
        case isDeleted = "is_deleted"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
        case syncStatus = "sync_status"
        case syncError = "sync_error"
        case localAudioPath = "local_audio_path"
    }
    
    // MARK: - Conversion to API Model
    
    func toNoteResponse() -> NoteResponse {
        let tagsArray = (try? JSONDecoder().decode([String].self, from: tags.data(using: .utf8) ?? Data())) ?? []
        
        return NoteResponse(
            id: UUID(uuidString: id) ?? UUID(),
            title: title,
            transcript: content,
            summary: nil,  // Not stored in database
            duration: nil,  // Not stored in database
            audioUrl: nil,  // Not stored in database (uses localAudioPath instead)
            folderId: folderId.flatMap { UUID(uuidString: $0) },
            folderName: nil,  // Not stored in database
            tags: tagsArray,
            isPinned: isPinned,
            isArchived: isArchived,
            aiProcessed: false,  // Not stored in database
            actions: [],  // Loaded separately
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
    
    // MARK: - Conversion from API Model
    
    static func from(_ note: NoteResponse, localAudioPath: String? = nil) -> DBNote {
        let tagsJSON = (try? JSONEncoder().encode(note.tags).asString()) ?? "[]"
        
        return DBNote(
            id: note.id.uuidString,
            title: note.title,
            content: note.transcript,
            folderId: note.folderId?.uuidString,
            tags: tagsJSON,
            isPinned: note.isPinned,
            isArchived: note.isArchived,
            isDeleted: false,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
            syncedAt: Date(),
            syncStatus: "synced",
            syncError: nil,
            localAudioPath: localAudioPath
        )
    }
}

// MARK: - Database Folder Model

/// Database representation of a Folder (matches SQLite schema)
struct DBFolder: Codable, FetchableRecord, PersistableRecord {
    var id: String
    var name: String
    var emoji: String?
    var color: String?
    var parentId: String?
    var sortOrder: Int
    var createdAt: Date
    var updatedAt: Date
    var syncStatus: String
    var syncError: String?
    var isLocalDeleted: Bool
    
    // MARK: - Table Name
    
    static let databaseTableName = "folders"
    
    // MARK: - Coding Keys
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case emoji
        case color
        case parentId = "parent_id"
        case sortOrder = "sort_order"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncStatus = "sync_status"
        case syncError = "sync_error"
        case isLocalDeleted = "is_local_deleted"
    }
    
    // MARK: - Conversion to API Model
    
    func toFolderResponse(noteCount: Int = 0, depth: Int = 0, children: [FolderResponse] = []) -> FolderResponse {
        return FolderResponse(
            id: UUID(uuidString: id) ?? UUID(),
            name: name,
            icon: emoji ?? "folder.fill",
            color: color,
            isSystem: false,  // Not stored in database
            noteCount: noteCount,
            sortOrder: sortOrder,
            parentId: parentId.flatMap { UUID(uuidString: $0) },
            depth: depth,
            children: children,
            createdAt: createdAt
        )
    }
    
    // MARK: - Conversion from API Model
    
    static func from(_ folder: FolderResponse) -> DBFolder {
        return DBFolder(
            id: folder.id.uuidString,
            name: folder.name,
            emoji: folder.icon,
            color: folder.color,
            parentId: folder.parentId?.uuidString,
            sortOrder: folder.sortOrder,
            createdAt: folder.createdAt,
            updatedAt: Date(),
            syncStatus: "synced",
            syncError: nil,
            isLocalDeleted: false
        )
    }
}

// MARK: - Database Action Model

/// Database representation of an Action (matches SQLite schema)
struct DBAction: Codable, FetchableRecord, PersistableRecord {
    var id: String
    var noteId: String
    var actionType: String
    var status: String
    var priority: String
    var title: String
    var description: String?
    var scheduledDate: Date?
    var scheduledEndDate: Date?
    var location: String?
    var attendees: String  // JSON string
    var emailTo: String?
    var emailSubject: String?
    var emailBody: String?
    var externalId: String?
    var externalService: String?
    var externalUrl: String?
    var createdAt: Date
    var executedAt: Date?
    var syncStatus: String
    var syncError: String?
    
    // MARK: - Table Name
    
    static let databaseTableName = "actions"
    
    // MARK: - Coding Keys
    
    enum CodingKeys: String, CodingKey {
        case id
        case noteId = "note_id"
        case actionType = "action_type"
        case status
        case priority
        case title
        case description
        case scheduledDate = "scheduled_date"
        case scheduledEndDate = "scheduled_end_date"
        case location
        case attendees
        case emailTo = "email_to"
        case emailSubject = "email_subject"
        case emailBody = "email_body"
        case externalId = "external_id"
        case externalService = "external_service"
        case externalUrl = "external_url"
        case createdAt = "created_at"
        case executedAt = "executed_at"
        case syncStatus = "sync_status"
        case syncError = "sync_error"
    }
    
    // MARK: - Conversion to API Model
    
    func toActionResponse() -> ActionResponse? {
        guard let actionType = ActionType(rawValue: actionType),
              let status = ActionStatus(rawValue: status),
              let priority = ActionPriority(rawValue: priority) else {
            return nil
        }
        
        let attendeesArray = (try? JSONDecoder().decode([String].self, from: attendees.data(using: .utf8) ?? Data())) ?? []
        
        return ActionResponse(
            id: UUID(uuidString: id) ?? UUID(),
            noteId: UUID(uuidString: noteId) ?? UUID(),
            actionType: actionType,
            status: status,
            priority: priority,
            title: title,
            description: description,
            scheduledDate: scheduledDate,
            scheduledEndDate: scheduledEndDate,
            location: location,
            attendees: attendeesArray,
            emailTo: emailTo,
            emailSubject: emailSubject,
            emailBody: emailBody,
            externalId: externalId,
            externalService: externalService,
            externalUrl: externalUrl,
            createdAt: createdAt,
            executedAt: executedAt
        )
    }
    
    // MARK: - Conversion from API Model
    
    static func from(_ action: ActionResponse) -> DBAction {
        let attendeesJSON = (try? JSONEncoder().encode(action.attendees).asString()) ?? "[]"
        
        return DBAction(
            id: action.id.uuidString,
            noteId: action.noteId.uuidString,
            actionType: action.actionType.rawValue,
            status: action.status.rawValue,
            priority: action.priority.rawValue,
            title: action.title,
            description: action.description,
            scheduledDate: action.scheduledDate,
            scheduledEndDate: action.scheduledEndDate,
            location: action.location,
            attendees: attendeesJSON,
            emailTo: action.emailTo,
            emailSubject: action.emailSubject,
            emailBody: action.emailBody,
            externalId: action.externalId,
            externalService: action.externalService,
            externalUrl: action.externalUrl,
            createdAt: action.createdAt,
            executedAt: action.executedAt,
            syncStatus: "synced",
            syncError: nil
        )
    }
}

// MARK: - Helper Extension

extension Data {
    func asString() -> String {
        String(data: self, encoding: .utf8) ?? ""
    }
}
