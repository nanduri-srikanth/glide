//
//  SyncQueueRepository.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Sync queue repository for tracking pending offline changes
//

import Foundation
import GRDB

/// Sync operation types
enum SyncOperation: String, Codable {
    case create
    case update
    case delete
}

/// Sync entity types
enum SyncEntityType: String, Codable {
    case note
    case folder
    case action
}

/// Sync queue entry
struct SyncQueueEntry: Codable, Identifiable {
    let id: Int64
    let operation: SyncOperation
    let entityType: SyncEntityType
    let entityId: String
    let payload: String // JSON data
    let createdAt: Date
    var attempts: Int
    var lastError: String?
}

/// Local Sync Queue Repository for tracking pending offline changes
class SyncQueueRepository {

    // MARK: - Properties

    private let database: DatabaseQueue
    private let logger = LoggerService.shared

    // MARK: - Initialization

    init(database: DatabaseQueue) {
        self.database = database
    }

    // MARK: - CRUD Operations

    /// Add entry to sync queue
    func enqueue(operation: SyncOperation, entityType: SyncEntityType, entityId: String, payload: Encodable) throws {
        let payloadData = try JSONEncoder().encode(payload)
        let payloadString = String(data: payloadData, encoding: .utf8) ?? "{}"

        try database.write { database in
            try database.execute(
                sql: """
                INSERT INTO sync_queue (operation, entity_type, entity_id, payload, created_at, attempts)
                VALUES (?, ?, ?, ?, ?, 0)
                """,
                arguments: [operation.rawValue, entityType.rawValue, entityId, payloadString, Date()]
            )
        }
        logger.debug("Sync queue entry added: \(entityType.rawValue)/\(entityId) - \(operation.rawValue)")
    }

    /// Fetch all pending sync entries
    func fetchAll() throws -> [SyncQueueEntry] {
        return try database.read { database in
            return try SyncQueueEntry.fetchAll(database, sql: """
                SELECT * FROM sync_queue
                ORDER BY created_at ASC
                """)
        }
    }

    /// Fetch pending entries by entity type
    func fetchByEntityType(entityType: SyncEntityType) throws -> [SyncQueueEntry] {
        return try database.read { database in
            return try SyncQueueEntry.fetchAll(database, sql: """
                SELECT * FROM sync_queue
                WHERE entity_type = ?
                ORDER BY created_at ASC
                """, arguments: [entityType.rawValue])
        }
    }

    /// Fetch pending entries for a specific entity
    func fetchByEntity(entityType: SyncEntityType, entityId: String) throws -> [SyncQueueEntry] {
        return try database.read { database in
            return try SyncQueueEntry.fetchAll(database, sql: """
                SELECT * FROM sync_queue
                WHERE entity_type = ? AND entity_id = ?
                ORDER BY created_at ASC
                """, arguments: [entityType.rawValue, entityId])
        }
    }

    /// Fetch entries with low attempt count (to retry failed syncs)
    func fetchRetryable(maxAttempts: Int = 3) throws -> [SyncQueueEntry] {
        return try database.read { database in
            return try SyncQueueEntry.fetchAll(database, sql: """
                SELECT * FROM sync_queue
                WHERE attempts < ?
                ORDER BY created_at ASC
                """, arguments: [maxAttempts])
        }
    }

    /// Mark entry as successful (remove from queue)
    func markSuccessful(id: Int64) throws {
        try database.write { database in
            try database.execute(
                sql: "DELETE FROM sync_queue WHERE id = ?",
                arguments: [id]
            )
        }
        logger.debug("Sync queue entry marked successful: \(id)")
    }

    /// Mark entry as failed (increment attempts, store error)
    func markFailed(id: Int64, error: Error) throws {
        try database.write { database in
            try database.execute(
                sql: """
                UPDATE sync_queue
                SET attempts = attempts + 1, last_error = ?
                WHERE id = ?
                """,
                arguments: [error.localizedDescription, id]
            )
        }
        logger.debug("Sync queue entry marked failed: \(id) - \(error.localizedDescription)")
    }

    /// Remove entry from queue
    func remove(id: Int64) throws {
        try database.write { database in
            try database.execute(
                sql: "DELETE FROM sync_queue WHERE id = ?",
                arguments: [id]
            )
        }
        logger.debug("Sync queue entry removed: \(id)")
    }

    /// Clear all entries for an entity
    func clearEntity(entityType: SyncEntityType, entityId: String) throws {
        try database.write { database in
            try database.execute(
                sql: "DELETE FROM sync_queue WHERE entity_type = ? AND entity_id = ?",
                arguments: [entityType.rawValue, entityId]
            )
        }
        logger.debug("Sync queue cleared for entity: \(entityType.rawValue)/\(entityId)")
    }

    /// Clear all completed syncs
    func clearAll() throws {
        try database.write { database in
            try database.execute(sql: "DELETE FROM sync_queue")
        }
        logger.debug("Sync queue cleared")
    }

    /// Get queue size
    func count() throws -> Int {
        return try database.read { database in
            return try Int.fetchOne(database, sql: "SELECT COUNT(*) FROM sync_queue") ?? 0
        }
    }

    /// Get queue size by entity type
    func countByEntityType(entityType: SyncEntityType) throws -> Int {
        return try database.read { database in
            return try Int.fetchOne(
                database,
                sql: "SELECT COUNT(*) FROM sync_queue WHERE entity_type = ?",
                arguments: [entityType.rawValue]
            ) ?? 0
        }
    }

    /// Get queue size by entity
    func countByEntity(entityType: SyncEntityType, entityId: String) throws -> Int {
        return try database.read { database in
            return try Int.fetchOne(
                database,
                sql: "SELECT COUNT(*) FROM sync_queue WHERE entity_type = ? AND entity_id = ?",
                arguments: [entityType.rawValue, entityId]
            ) ?? 0
        }
    }
}

// MARK: - SyncQueueEntry GRDB Mapping

extension SyncQueueEntry: FetchableRecord {

    /// Decode SyncQueueEntry from database row
    init(row: Row) throws {
        self.init(
            id: row["id"],
            operation: SyncOperation(rawValue: row["operation"]) ?? .create,
            entityType: SyncEntityType(rawValue: row["entity_type"]) ?? .note,
            entityId: row["entity_id"],
            payload: row["payload"],
            createdAt: row["created_at"],
            attempts: row["attempts"],
            lastError: row["last_error"]
        )
    }
}
