//
//  LocalActionRepository.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Local SQLite repository for offline action storage
//

import Foundation
import GRDB

/// Local Action Repository for offline-first action storage
class LocalActionRepository {

    // MARK: - Properties

    private let database: DatabaseQueue
    private let logger = LoggerService.shared

    // MARK: - Initialization

    init(database: DatabaseQueue) {
        self.database = database
    }

    // MARK: - CRUD Operations

    /// Fetch all actions
    func fetchAll() throws -> [Action] {
        return try database.read { database in
            return try Action.fetchAll(database, sql: """
                SELECT * FROM actions
                ORDER BY created_at DESC
                """)
        }
    }

    /// Fetch actions by note ID
    func fetchByNote(noteId: String) throws -> [Action] {
        return try database.read { database in
            return try Action.fetchAll(database, sql: """
                SELECT * FROM actions
                WHERE note_id = ?
                ORDER BY created_at DESC
                """, arguments: [noteId])
        }
    }

    /// Fetch pending actions
    func fetchPending() throws -> [Action] {
        return try database.read { database in
            return try Action.fetchAll(database, sql: """
                SELECT * FROM actions
                WHERE status IN ('pending', 'created')
                ORDER BY priority DESC, created_at ASC
                """)
        }
    }

    /// Fetch actions by type
    func fetchByType(actionType: ActionType) throws -> [Action] {
        return try database.read { database in
            return try Action.fetchAll(database, sql: """
                SELECT * FROM actions
                WHERE action_type = ?
                ORDER BY created_at DESC
                """, arguments: [actionType.rawValue])
        }
    }

    /// Fetch actions by status
    func fetchByStatus(status: ActionStatus) throws -> [Action] {
        return try database.read { database in
            return try Action.fetchAll(database, sql: """
                SELECT * FROM actions
                WHERE status = ?
                ORDER BY created_at DESC
                """, arguments: [status.rawValue])
        }
    }

    /// Fetch actions pending sync
    func fetchPendingSync() throws -> [Action] {
        return try database.read { database in
            return try Action.fetchAll(database, sql: """
                SELECT * FROM actions
                WHERE sync_status != 'synced'
                ORDER BY created_at DESC
                """)
        }
    }

    /// Fetch scheduled actions (with scheduled_date set and not executed)
    func fetchScheduled() throws -> [Action] {
        return try database.read { database in
            return try Action.fetchAll(database, sql: """
                SELECT * FROM actions
                WHERE scheduled_date IS NOT NULL
                AND status NOT IN ('executed', 'failed', 'cancelled')
                ORDER BY scheduled_date ASC
                """)
        }
    }

    /// Fetch action by ID
    func fetchById(id: String) throws -> Action? {
        return try database.read { database in
            return try Action.fetchOne(database, sql: "SELECT * FROM actions WHERE id = ?", arguments: [id])
        }
    }

    /// Insert a new action
    func insert(_ action: Action) throws {
        try database.write { database in
            try action.insert(database)
        }
        logger.debug("Action inserted: \(action.id)")
    }

    /// Batch insert actions
    func insert(_ actions: [Action]) throws {
        try database.write { database in
            for action in actions {
                try action.insert(database)
            }
        }
        logger.debug("Actions inserted: \(actions.count)")
    }

    /// Update an existing action
    func update(_ action: Action) throws {
        try database.write { database in
            try action.update(database)
        }
        logger.debug("Action updated: \(action.id)")
    }

    /// Delete an action
    func delete(id: String) throws {
        try database.write { database in
            try database.execute(
                sql: "DELETE FROM actions WHERE id = ?",
                arguments: [id]
            )
        }
        logger.debug("Action deleted: \(id)")
    }

    /// Delete all actions for a note
    func deleteByNote(noteId: String) throws {
        try database.write { database in
            try database.execute(
                sql: "DELETE FROM actions WHERE note_id = ?",
                arguments: [noteId]
            )
        }
        logger.debug("Actions deleted for note: \(noteId)")
    }

    /// Count all actions
    func count() throws -> Int {
        return try database.read { database in
            return try Int.fetchOne(database, sql: "SELECT COUNT(*) FROM actions") ?? 0
        }
    }

    /// Count actions by note
    func countByNote(noteId: String) throws -> Int {
        return try database.read { database in
            return try Int.fetchOne(
                database,
                sql: "SELECT COUNT(*) FROM actions WHERE note_id = ?",
                arguments: [noteId]
            ) ?? 0
        }
    }

    /// Count pending actions
    func countPending() throws -> Int {
        return try database.read { database in
            return try Int.fetchOne(
                database,
                sql: "SELECT COUNT(*) FROM actions WHERE status IN ('pending', 'created')"
            ) ?? 0
        }
    }

    /// Count actions by type
    func countByType(actionType: ActionType) throws -> Int {
        return try database.read { database in
            return try Int.fetchOne(
                database,
                sql: "SELECT COUNT(*) FROM actions WHERE action_type = ?",
                arguments: [actionType.rawValue]
            ) ?? 0
        }
    }
}

// MARK: - Action GRDB Mapping

extension Action: FetchableRecord, PersistableRecord {

    /// Decode Action from database row
    init(row: Row) throws {
        let attendeesJSON: String = row["attendees"]
        let attendees = try JSONDecoder().decode([String].self, from: attendeesJSON.data(using: .utf8) ?? Data())

        self.init(
            id: row["id"],
            noteId: row["note_id"],
            actionType: ActionType(rawValue: row["action_type"]) ?? .nextStep,
            status: ActionStatus(rawValue: row["status"]) ?? .pending,
            priority: ActionPriority(rawValue: row["priority"]) ?? .medium,
            title: row["title"],
            description: row["description"],
            scheduledDate: row["scheduled_date"],
            scheduledEndDate: row["scheduled_end_date"],
            location: row["location"],
            attendees: attendees,
            emailTo: row["email_to"],
            emailSubject: row["email_subject"],
            emailBody: row["email_body"],
            externalId: row["external_id"],
            externalService: row["external_service"],
            externalUrl: row["external_url"],
            createdAt: row["created_at"],
            executedAt: row["executed_at"]
        )
    }

    /// Encode Action to database (EncodableRecord conformance)
    func encode(to container: inout PersistenceContainer) throws {
        let attendeesData = try JSONEncoder().encode(attendees)
        let attendeesJSON = String(data: attendeesData, encoding: .utf8) ?? "[]"

        container["id"] = id
        container["note_id"] = noteId
        container["action_type"] = actionType.rawValue
        container["status"] = status.rawValue
        container["priority"] = priority.rawValue
        container["title"] = title
        container["description"] = description
        container["scheduled_date"] = scheduledDate
        container["scheduled_end_date"] = scheduledEndDate
        container["location"] = location
        container["attendees"] = attendeesJSON
        container["email_to"] = emailTo
        container["email_subject"] = emailSubject
        container["email_body"] = emailBody
        container["external_id"] = externalId
        container["external_service"] = externalService
        container["external_url"] = externalUrl
        container["created_at"] = createdAt
        container["executed_at"] = executedAt
    }
}
