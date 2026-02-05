//
//  Models.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Core data models for database operations
//

import Foundation

// MARK: - Note

/// Note model for database and API operations
struct Note: Codable, Identifiable {
    let id: String
    var title: String
    var content: String
    var folderId: String?
    var tags: [String]
    var isPinned: Bool
    var isArchived: Bool
    var isDeleted: Bool
    var createdAt: Date
    var updatedAt: Date
    var syncedAt: Date?
}

// MARK: - Folder

/// Folder model for database and API operations
struct Folder: Codable, Identifiable {
    let id: String
    var name: String
    var emoji: String?
    var color: String?
    var parentId: String?
    var sortOrder: Int
    var createdAt: Date
    var updatedAt: Date
}

// MARK: - Action

/// Action model for database operations
struct Action: Codable, Identifiable {
    let id: String
    var noteId: String
    var actionType: ActionType
    var status: ActionStatus
    var priority: ActionPriority
    var title: String
    var description: String?
    var scheduledDate: Date?
    var scheduledEndDate: Date?
    var location: String?
    var attendees: [String]
    var emailTo: String?
    var emailSubject: String?
    var emailBody: String?
    var externalId: String?
    var externalService: String?
    var externalUrl: String?
    var createdAt: Date
    var executedAt: Date?
}

// MARK: - Action Enums

/// Action type enumeration
enum ActionType: String, Codable {
    case nextStep = "next_step"
    case meeting = "meeting"
    case email = "email"
    case reminder = "reminder"
    case task = "task"
}

/// Action status enumeration
enum ActionStatus: String, Codable {
    case pending = "pending"
    case created = "created"
    case completed = "completed"
    case failed = "failed"
    case cancelled = "cancelled"
}

/// Action priority enumeration
enum ActionPriority: String, Codable {
    case low = "low"
    case medium = "medium"
    case high = "high"
}

// MARK: - Folder Hierarchy

/// Folder reorder item
struct FolderReorderItem: Codable {
    let id: String
    let sortOrder: Int
}
