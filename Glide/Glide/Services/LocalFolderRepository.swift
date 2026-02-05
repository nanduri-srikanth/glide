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
            return try Folder.fetchAll(database, sql: """
                SELECT * FROM folders
                WHERE is_local_deleted = 0
                ORDER BY sort_order ASC
                """)
        }
    }

    /// Fetch root folders (no parent)
    func fetchRootFolders() throws -> [Folder] {
        return try database.read { database in
            return try Folder.fetchAll(database, sql: """
                SELECT * FROM folders
                WHERE parent_id IS NULL
                AND is_local_deleted = 0
                ORDER BY sort_order ASC
                """)
        }
    }

    /// Fetch child folders by parent ID
    func fetchChildren(parentId: String) throws -> [Folder] {
        return try database.read { database in
            return try Folder.fetchAll(database, sql: """
                SELECT * FROM folders
                WHERE parent_id = ?
                AND is_local_deleted = 0
                ORDER BY sort_order ASC
                """, arguments: [parentId])
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

            if let parentId = folder.parentId {
                // Modify the parent node's children array
                folderMap[parentId]?.children.append(node)
            } else {
                rootNodes.append(node)
            }
        }

        return rootNodes
    }

    /// Fetch folder by ID
    func fetchById(id: String) throws -> Folder? {
        return try database.read { database in
            return try Folder.fetchOne(database, sql: "SELECT * FROM folders WHERE id = ?", arguments: [id])
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
            try folder.insert(database)
        }
        logger.debug("Folder inserted: \(folder.id)")
    }

    /// Update an existing folder
    func update(_ folder: Folder) throws {
        try database.write { database in
            try folder.update(database)
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
                arguments: [toParentId as String?, newSortOrder, Date(), folderId]
            )
        }
        logger.debug("Folder moved: \(folderId)")
    }

    /// Get next sort order for siblings
    func getNextSortOrder(parentId: String?) throws -> Int {
        return try database.read { database in
            if let parentId = parentId {
                let sql = "SELECT MAX(sort_order) FROM folders WHERE parent_id = ?"
                let maxOrder = try Int.fetchOne(database, sql: sql, arguments: [parentId]) ?? 0
                return maxOrder + 1
            } else {
                let sql = "SELECT MAX(sort_order) FROM folders WHERE parent_id IS NULL"
                let maxOrder = try Int.fetchOne(database, sql: sql) ?? 0
                return maxOrder + 1
            }
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
    init(row: Row) throws {
        self.init(
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

    /// Encode Folder to database (EncodableRecord conformance)
    func encode(to container: inout PersistenceContainer) throws {
        container["id"] = id
        container["name"] = name
        container["emoji"] = emoji
        container["color"] = color
        container["parent_id"] = parentId
        container["sort_order"] = sortOrder
        container["created_at"] = createdAt
        container["updated_at"] = updatedAt
    }
}
