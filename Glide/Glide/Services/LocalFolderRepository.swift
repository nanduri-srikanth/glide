//
//  LocalFolderRepository.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Local SQLite repository for offline folder storage with hierarchy support
//

import Foundation
import GRDB

/// Local Folder Repository for offline-first folder storage
class LocalFolderRepository {

    // MARK: - Properties

    private let database: DatabaseQueue
    private let logger = LoggerService.shared

    // MARK: - Initialization

    init(database: DatabaseQueue) {
        self.database = database
    }

    // MARK: - CRUD Operations

    /// Fetch all folders
    func fetchAll() throws -> [Folder] {
        return try database.read { database in
            let request = SQLRequest<Folder>(
                sql: """
                SELECT * FROM folders
                WHERE is_local_deleted = 0
                ORDER BY sort_order ASC
                """
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Folder.decodeRow($0) }
        }
    }

    /// Fetch root folders (no parent)
    func fetchRootFolders() throws -> [Folder] {
        return try database.read { database in
            let request = SQLRequest<Folder>(
                sql: """
                SELECT * FROM folders
                WHERE parent_id IS NULL
                AND is_local_deleted = 0
                ORDER BY sort_order ASC
                """
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Folder.decodeRow($0) }
        }
    }

    /// Fetch child folders by parent ID
    func fetchChildren(parentId: String) throws -> [Folder] {
        return try database.read { database in
            let request = SQLRequest<Folder>(
                sql: """
                SELECT * FROM folders
                WHERE parent_id = ?
                AND is_local_deleted = 0
                ORDER BY sort_order ASC
                """,
                arguments: [parentId]
            )

            return try Row.fetchAll(database, request)
                .compactMap { try? Folder.decodeRow($0) }
        }
    }

    /// Fetch folder hierarchy tree
    func fetchHierarchy() throws -> [FolderNode] {
        let allFolders = try fetchAll()
        var folderMap: [String: FolderNode] = [:]

        // Create nodes for all folders
        for folder in allFolders {
            folderMap[folder.id] = FolderNode(folder: folder, children: [])
        }

        // Build tree structure
        var rootNodes: [FolderNode] = []
        for folder in allFolders {
            let node = folderMap[folder.id]!

            if let parentId = folder.parentId, let parentNode = folderMap[parentId] {
                parentNode.children.append(node)
            } else {
                rootNodes.append(node)
            }
        }

        return rootNodes
    }

    /// Fetch folder by ID
    func fetchById(id: String) throws -> Folder? {
        return try database.read { database in
            let request = SQLRequest<Folder>(
                sql: "SELECT * FROM folders WHERE id = ?",
                arguments: [id]
            )

            guard let row = try Row.fetchOne(database, request) else {
                return nil
            }

            return try Folder.decodeRow(row)
        }
    }

    /// Fetch folder path (all ancestors)
    func fetchPath(folderId: String) throws -> [Folder] {
        var path: [Folder] = []
        var currentId: String? = folderId

        while let id = currentId {
            guard let folder = try fetchById(id: id) else {
                break
            }

            path.insert(folder, at: 0)
            currentId = folder.parentId
        }

        return path
    }

    /// Insert a new folder
    func insert(_ folder: Folder) throws {
        try database.write { database in
            try folder.encodeRow(database)
        }
        logger.debug("Folder inserted: \(folder.id)")
    }

    /// Update an existing folder
    func update(_ folder: Folder) throws {
        try database.write { database in
            try folder.encodeRow(database)
        }
        logger.debug("Folder updated: \(folder.id)")
    }

    /// Delete a folder (soft delete)
    func delete(id: String) throws {
        try database.write { database in
            try database.execute(
                sql: "UPDATE folders SET is_local_deleted = 1, updated_at = ? WHERE id = ?",
                arguments: [Date(), id]
            )
        }
        logger.debug("Folder deleted: \(id)")
    }

    /// Permanently delete a folder
    func permanentDelete(id: String) throws {
        try database.write { database in
            try database.execute(
                sql: "DELETE FROM folders WHERE id = ?",
                arguments: [id]
            )
        }
        logger.debug("Folder permanently deleted: \(id)")
    }

    /// Move folder to new parent
    func move(folderId: String, toParentId: String?, newSortOrder: Int) throws {
        try database.write { database in
            try database.execute(
                sql: """
                UPDATE folders
                SET parent_id = ?, sort_order = ?, updated_at = ?
                WHERE id = ?
                """,
                arguments: [toParentId, newSortOrder, Date(), folderId]
            )
        }
        logger.debug("Folder moved: \(folderId)")
    }

    /// Get next sort order for siblings
    func getNextSortOrder(parentId: String?) throws -> Int {
        return try database.read { database in
            let sql: String
            let arguments: [Any?]

            if let parentId = parentId {
                sql = "SELECT MAX(sort_order) FROM folders WHERE parent_id = ?"
                arguments = [parentId]
            } else {
                sql = "SELECT MAX(sort_order) FROM folders WHERE parent_id IS NULL"
                arguments = []
            }

            let maxOrder = try Int.fetchOne(database, sql: sql, arguments: StatementArguments(arguments)) ?? 0
            return maxOrder + 1
        }
    }

    /// Count all folders
    func count() throws -> Int {
        return try database.read { database in
            return try Int.fetchOne(
                database,
                sql: "SELECT COUNT(*) FROM folders WHERE is_local_deleted = 0"
            ) ?? 0
        }
    }

    /// Count children of a folder
    func countChildren(parentId: String) throws -> Int {
        return try database.read { database in
            return try Int.fetchOne(
                database,
                sql: "SELECT COUNT(*) FROM folders WHERE parent_id = ? AND is_local_deleted = 0",
                arguments: [parentId]
            ) ?? 0
        }
    }
}

// MARK: - Folder Hierarchy Node

/// Folder tree node for hierarchy representation
struct FolderNode {
    let folder: Folder
    var children: [FolderNode] = []

    var depth: Int {
        var depth = 0
        var current: FolderNode? = self
        while current != nil {
            depth += 1
            current = current?.children.first // Simplified for example
        }
        return depth
    }
}

// MARK: - Folder GRDB Mapping

extension Folder: FetchableRecord, PersistableRecord {

    /// Decode Folder from database row
    static func decodeRow(_ row: Row) throws -> Folder {
        return Folder(
            id: row["id"],
            name: row["name"],
            emoji: row["emoji"],
            color: row["color"],
            parentId: row["parent_id"],
            sortOrder: row["sort_order"],
            createdAt: row["created_at"],
            updatedAt: row["updated_at"]
        )
    }

    /// Encode Folder to database
    func encodeRow(_ database: Database) throws {
        // Use upsert to handle both insert and update
        try database.execute(
            sql: """
            INSERT INTO folders (
                id, name, emoji, color, parent_id, sort_order,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                emoji = excluded.emoji,
                color = excluded.color,
                parent_id = excluded.parent_id,
                sort_order = excluded.sort_order,
                updated_at = excluded.updated_at
            """,
            arguments: [
                id, name, emoji, color, parentId, sortOrder,
                createdAt, updatedAt
            ]
        )
    }
}
