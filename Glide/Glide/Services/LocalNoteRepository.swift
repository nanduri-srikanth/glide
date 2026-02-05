//
//  LocalNoteRepository.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Local SQLite repository for offline note storage
//

import Foundation
import GRDB

/// Local Note Repository for offline-first note storage
class LocalNoteRepository {

    // MARK: - Properties

    private let database: DatabaseQueue
    private let logger = LoggerService.shared

    // MARK: - Initialization

    init(database: DatabaseQueue) {
        self.database = database
    }

    // MARK: - CRUD Operations

    /// Fetch all notes
    func fetchAll(includeDeleted: Bool = false) throws -> [Note] {
        return try database.read { database in
            if includeDeleted {
                return try Note.fetchAll(database, sql: "SELECT * FROM notes ORDER BY created_at DESC")
            } else {
                return try Note.fetchAll(database, sql: """
                    SELECT * FROM notes
                    WHERE is_deleted = 0
                    ORDER BY created_at DESC
                    """)
            }
        }
    }

    /// Fetch notes by folder ID
    func fetchByFolder(folderId: String) throws -> [Note] {
        return try database.read { database in
            return try Note.fetchAll(database, sql: """
                SELECT * FROM notes
                WHERE folder_id = ?
                AND is_deleted = 0
                ORDER BY created_at DESC
                """, arguments: [folderId])
        }
    }

    /// Fetch notes pending sync
    func fetchPendingSync() throws -> [Note] {
        return try database.read { database in
            return try Note.fetchAll(database, sql: """
                SELECT * FROM notes
                WHERE sync_status != 'synced'
                ORDER BY created_at DESC
                """)
        }
    }

    /// Fetch pinned notes
    func fetchPinned() throws -> [Note] {
        return try database.read { database in
            return try Note.fetchAll(database, sql: """
                SELECT * FROM notes
                WHERE is_pinned = 1
                AND is_deleted = 0
                ORDER BY updated_at DESC
                """)
        }
    }

    /// Fetch archived notes
    func fetchArchived() throws -> [Note] {
        return try database.read { database in
            return try Note.fetchAll(database, sql: """
                SELECT * FROM notes
                WHERE is_archived = 1
                AND is_deleted = 0
                ORDER BY updated_at DESC
                """)
        }
    }

    /// Search notes by query
    func search(query: String) throws -> [Note] {
        return try database.read { database in
            let searchPattern = "%\(query)%"
            return try Note.fetchAll(database, sql: """
                SELECT * FROM notes
                WHERE (title LIKE ? OR content LIKE ?)
                AND is_deleted = 0
                ORDER BY created_at DESC
                """, arguments: [searchPattern, searchPattern])
        }
    }

    /// Fetch note by ID
    func fetchById(id: String) throws -> Note? {
        return try database.read { database in
            return try Note.fetchOne(database, sql: "SELECT * FROM notes WHERE id = ?", arguments: [id])
        }
    }

    /// Insert a new note
    func insert(_ note: Note) throws {
        try database.write { database in
            try note.insert(database)
        }
        logger.debug("Note inserted: \(note.id)")
    }

    /// Update an existing note
    func update(_ note: Note) throws {
        try database.write { database in
            try note.update(database)
        }
        logger.debug("Note updated: \(note.id)")
    }

    /// Delete a note (soft delete)
    func delete(id: String) throws {
        try database.write { database in
            try database.execute(
                sql: "UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id = ?",
                arguments: [Date(), id]
            )
        }
        logger.debug("Note deleted: \(id)")
    }

    /// Permanently delete a note
    func permanentDelete(id: String) throws {
        try database.write { database in
            try database.execute(
                sql: "DELETE FROM notes WHERE id = ?",
                arguments: [id]
            )
        }
        logger.debug("Note permanently deleted: \(id)")
    }

    /// Count all notes
    func count(includeDeleted: Bool = false) throws -> Int {
        return try database.read { database in
            let sql = includeDeleted
                ? "SELECT COUNT(*) FROM notes"
                : "SELECT COUNT(*) FROM notes WHERE is_deleted = 0"

            return try Int.fetchOne(database, sql: sql) ?? 0
        }
    }

    /// Count notes by folder
    func countByFolder(folderId: String) throws -> Int {
        return try database.read { database in
            let sql = """
                SELECT COUNT(*) FROM notes
                WHERE folder_id = ? AND is_deleted = 0
            """

            return try Int.fetchOne(database, sql: sql, arguments: [folderId]) ?? 0
        }
    }
}

// MARK: - Note GRDB Mapping

extension Note: FetchableRecord, PersistableRecord {

    /// Decode Note from database row
    init(row: Row) throws {
        let tagsJSON: String = row["tags"]
        let tags = try JSONDecoder().decode([String].self, from: tagsJSON.data(using: .utf8) ?? Data())

        self.init(
            id: row["id"],
            title: row["title"],
            content: row["content"],
            folderId: row["folder_id"],
            tags: tags,
            isPinned: row["is_pinned"],
            isArchived: row["is_archived"],
            isDeleted: row["is_deleted"],
            createdAt: row["created_at"],
            updatedAt: row["updated_at"],
            syncedAt: row["synced_at"]
        )
    }

    /// Encode Note to database (EncodableRecord conformance)
    func encode(to container: inout PersistenceContainer) throws {
        let tagsData = try JSONEncoder().encode(tags)
        let tagsJSON = String(data: tagsData, encoding: .utf8) ?? "[]"

        container["id"] = id
        container["title"] = title
        container["content"] = content
        container["folder_id"] = folderId
        container["tags"] = tagsJSON
        container["is_pinned"] = isPinned
        container["is_archived"] = isArchived
        container["is_deleted"] = isDeleted
        container["created_at"] = createdAt
        container["updated_at"] = updatedAt
        container["synced_at"] = syncedAt
    }
}
