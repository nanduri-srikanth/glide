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
            var request = SQLRequest<Note>(
                sql: """
                SELECT * FROM notes
                WHERE is_deleted = 0
                ORDER BY created_at DESC
                """
            )

            if includeDeleted {
                request = SQLRequest<Note>(
                    sql: "SELECT * FROM notes ORDER BY created_at DESC"
                )
            }

            return try Row.fetchAll(database, request)
                .compactMap { try? Note.decodeRow($0) }
        }
    }

    /// Fetch notes by folder ID
    func fetchByFolder(folderId: String) throws -> [Note] {
        return try database.read { database in
            let request = SQLRequest<Note>(
                sql: """
                SELECT * FROM notes
                WHERE folder_id = ?
                AND is_deleted = 0
                ORDER BY created_at DESC
                """,
                arguments: [folderId]
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Note.decodeRow($0) }
        }
    }

    /// Fetch notes pending sync
    func fetchPendingSync() throws -> [Note] {
        return try database.read { database in
            let request = SQLRequest<Note>(
                sql: """
                SELECT * FROM notes
                WHERE sync_status != 'synced'
                ORDER BY created_at DESC
                """
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Note.decodeRow($0) }
        }
    }

    /// Fetch pinned notes
    func fetchPinned() throws -> [Note] {
        return try database.read { database in
            let request = SQLRequest<Note>(
                sql: """
                SELECT * FROM notes
                WHERE is_pinned = 1
                AND is_deleted = 0
                ORDER BY updated_at DESC
                """
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Note.decodeRow($0) }
        }
    }

    /// Fetch archived notes
    func fetchArchived() throws -> [Note] {
        return try database.read { database in
            let request = SQLRequest<Note>(
                sql: """
                SELECT * FROM notes
                WHERE is_archived = 1
                AND is_deleted = 0
                ORDER BY updated_at DESC
                """
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Note.decodeRow($0) }
        }
    }

    /// Search notes by query
    func search(query: String) throws -> [Note] {
        return try database.read { database in
            let searchPattern = "%\(query)%"
            let request = SQLRequest<Note>(
                sql: """
                SELECT * FROM notes
                WHERE (title LIKE ? OR content LIKE ?)
                AND is_deleted = 0
                ORDER BY created_at DESC
                """,
                arguments: [searchPattern, searchPattern]
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Note.decodeRow($0) }
        }
    }

    /// Fetch note by ID
    func fetchById(id: String) throws -> Note? {
        return try database.read { database in
            let request = SQLRequest<Note>(
                sql: "SELECT * FROM notes WHERE id = ?",
                arguments: [id]
            )

            guard let row = try Row.fetchOne(database, request) else {
                return nil
            }

            return try Note.decodeRow(row)
        }
    }

    /// Insert a new note
    func insert(_ note: Note) throws {
        try database.write { database in
            try note.encodeRow(database)
        }
        logger.debug("Note inserted: \(note.id)")
    }

    /// Update an existing note
    func update(_ note: Note) throws {
        try database.write { database in
            try note.encodeRow(database)
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
    static func decodeRow(_ row: Row) throws -> Note {
        let tagsJSON: String = row["tags"]
        let tags = try JSONDecoder().decode([String].self, from: tagsJSON.data(using: .utf8) ?? Data())

        return Note(
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

    /// Encode Note to database
    func encodeRow(_ database: Database) throws {
        let tagsData = try JSONEncoder().encode(tags)
        let tagsJSON = String(data: tagsData, encoding: .utf8) ?? "[]"

        // Use upsert to handle both insert and update
        try database.execute(
            sql: """
            INSERT INTO notes (
                id, title, content, folder_id, tags, is_pinned, is_archived, is_deleted,
                created_at, updated_at, synced_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                folder_id = excluded.folder_id,
                tags = excluded.tags,
                is_pinned = excluded.is_pinned,
                is_archived = excluded.is_archived,
                is_deleted = excluded.is_deleted,
                updated_at = excluded.updated_at,
                synced_at = excluded.synced_at
            """,
            arguments: [
                id, title, content, folderId, tagsJSON, isPinned, isArchived, isDeleted,
                createdAt, updatedAt, syncedAt
            ]
        )
    }
}
