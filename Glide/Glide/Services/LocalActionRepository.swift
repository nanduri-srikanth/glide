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
            let request = SQLRequest<Action>(
                sql: """
                SELECT * FROM actions
                ORDER BY created_at DESC
                """
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Action.decodeRow($0) }
        }
    }

    /// Fetch actions by note ID
    func fetchByNote(noteId: String) throws -> [Action] {
        return try database.read { database in
            let request = SQLRequest<Action>(
                sql: """
                SELECT * FROM actions
                WHERE note_id = ?
                ORDER BY created_at DESC
                """,
                arguments: [noteId]
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Action.decodeRow($0) }
        }
    }

    /// Fetch pending actions
    func fetchPending() throws -> [Action] {
        return try database.read { database in
            let request = SQLRequest<Action>(
                sql: """
                SELECT * FROM actions
                WHERE status IN ('pending', 'created')
                ORDER BY priority DESC, created_at ASC
                """
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Action.decodeRow($0) }
        }
    }

    /// Fetch actions by type
    func fetchByType(actionType: ActionType) throws -> [Action] {
        return try database.read { database in
            let request = SQLRequest<Action>(
                sql: """
                SELECT * FROM actions
                WHERE action_type = ?
                ORDER BY created_at DESC
                """,
                arguments: [actionType.rawValue]
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Action.decodeRow($0) }
        }
    }

    /// Fetch actions by status
    func fetchByStatus(status: ActionStatus) throws -> [Action] {
        return try database.read { database in
            let request = SQLRequest<Action>(
                sql: """
                SELECT * FROM actions
                WHERE status = ?
                ORDER BY created_at DESC
                """,
                arguments: [status.rawValue]
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Action.decodeRow($0) }
        }
    }

    /// Fetch actions pending sync
    func fetchPendingSync() throws -> [Action] {
        return try database.read { database in
            let request = SQLRequest<Action>(
                sql: """
                SELECT * FROM actions
                WHERE sync_status != 'synced'
                ORDER BY created_at DESC
                """
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Action.decodeRow($0) }
        }
    }

    /// Fetch scheduled actions (with scheduled_date set and not executed)
    func fetchScheduled() throws -> [Action] {
        return try database.read { database in
            let request = SQLRequest<Action>(
                sql: """
                SELECT * FROM actions
                WHERE scheduled_date IS NOT NULL
                AND status NOT IN ('executed', 'failed', 'cancelled')
                ORDER BY scheduled_date ASC
                """
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Action.decodeRow($0) }
        }
    }

    /// Fetch action by ID
    func fetchById(id: String) throws -> Action? {
        return try database.read { database in
            let request = SQLRequest<Action>(
                sql: "SELECT * FROM actions WHERE id = ?",
                arguments: [id]
            )

            guard let row = try Row.fetchOne(database, request) else {
                return nil
            }

            return try Action.decodeRow(row)
        }
    }

    /// Insert a new action
    func insert(_ action: Action) throws {
        try database.write { database in
            try action.encodeRow(database)
        }
        logger.debug("Action inserted: \(action.id)")
    }

    /// Batch insert actions
    func insert(_ actions: [Action]) throws {
        try database.write { database in
            for action in actions {
                try action.encodeRow(database)
            }
        }
        logger.debug("Actions inserted: \(actions.count)")
    }

    /// Update an existing action
    func update(_ action: Action) throws {
        try database.write { database in
            try action.encodeRow(database)
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
    static func decodeRow(_ row: Row) throws -> Action {
        let attendeesJSON: String = row["attendees"]
        let attendees = try JSONDecoder().decode([String].self, from: attendeesJSON.data(using: .utf8) ?? Data())

        return Action(
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

    /// Encode Action to database
    func encodeRow(_ database: Database) throws {
        let attendeesData = try JSONEncoder().encode(attendees)
        let attendeesJSON = String(data: attendeesData, encoding: .utf8) ?? "[]"

        // Use upsert to handle both insert and update
        try database.execute(
            sql: """
            INSERT INTO actions (
                id, note_id, action_type, status, priority, title, description,
                scheduled_date, scheduled_end_date, location, attendees,
                email_to, email_subject, email_body,
                external_id, external_service, external_url,
                created_at, executed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                note_id = excluded.note_id,
                action_type = excluded.action_type,
                status = excluded.status,
                priority = excluded.priority,
                title = excluded.title,
                description = excluded.description,
                scheduled_date = excluded.scheduled_date,
                scheduled_end_date = excluded.scheduled_end_date,
                location = excluded.location,
                attendees = excluded.attendees,
                email_to = excluded.email_to,
                email_subject = excluded.email_subject,
                email_body = excluded.email_body,
                external_id = excluded.external_id,
                external_service = excluded.external_service,
                external_url = excluded.external_url,
                executed_at = excluded.executed_at
            """,
            arguments: [
                id, noteId, actionType.rawValue, status.rawValue, priority.rawValue,
                title, description, scheduledDate, scheduledEndDate, location,
                attendeesJSON, emailTo, emailSubject, emailBody,
                externalId, externalService, externalUrl, createdAt, executedAt
            ]
        )
    }
}
