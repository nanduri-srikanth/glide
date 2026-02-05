//
//  DatabaseManager.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Local SQLite database manager for offline-first data persistence
//

import Foundation
import GRDB

/// Database Manager for handling SQLite database operations
class DatabaseManager {

    // MARK: - Singleton

    static let shared = DatabaseManager()

    // MARK: - Properties

    private var db: DatabaseQueue?
    private let logger = LoggerService.shared

    /// Database file name
    private let dbName = "glide.sqlite3"

    /// Current database version
    private let currentVersion = 1

    // MARK: - Initialization

    private init() {}

    // MARK: - Public Methods

    /// Initialize the database
    func initialize() throws {
        let fileURL = try fileURL()

        // Configure database
        var config = Configuration()
        config.qtasynchronous = true // Enable Write-Ahead Logging for better performance
        config.maximumReaderCount = 5 // Allow concurrent reads
        config.trace = { event in
            self.logger.debug("Database: \(event)")
        }

        // Create database queue
        db = try DatabaseQueue(path: fileURL.path, configuration: config)

        // Setup schema
        try db?.write { database in
            try setupSchema(database)
        }

        logger.info("Database initialized at: \(fileURL.path)")
    }

    /// Get the database queue
    func getDatabase() throws -> DatabaseQueue {
        guard let database = db else {
            throw DatabaseError.notInitialized
        }
        return database
    }

    /// Reset the database (delete and recreate)
    func reset() throws {
        let fileURL = try fileURL()

        // Close existing connection
        db = nil

        // Delete file
        if FileManager.default.fileExists(atPath: fileURL.path) {
            try FileManager.default.removeItem(at: fileURL)
            logger.info("Database deleted")
        }

        // Reinitialize
        try initialize()
    }

    // MARK: - Private Methods

    /// Get the database file URL
    private func fileURL() throws -> URL {
        // Use application support directory for persistent storage
        let fileManager = FileManager.default
        guard let documentsURL = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            throw DatabaseError.fileDirectoryNotFound
        }

        // Create directory if needed
        let directoryURL = documentsURL.appendingPathComponent("Glide")
        if !fileManager.fileExists(atPath: directoryURL.path) {
            try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        }

        return directoryURL.appendingPathComponent(dbName)
    }

    /// Setup database schema with migrations
    private func setupSchema(_ database: Database) throws {
        // Create migrations table
        try database.create(table: "grdb_migrations") { table in
            table.column("name", .text).primaryKey()
            table.column("applied_at", .datetime).notNull()
        }

        // Apply migrations
        try migrate(database)

        logger.info("Database schema setup complete")
    }

    /// Apply database migrations
    private func migrate(_ database: Database) throws {
        var migrator = DatabaseMigrator()

        // Migration 1: Initial schema
        migrator.registerMigration("v1_initial_schema") { database in
            // Notes table
            try database.create(table: "notes") { table in
                table.column("id", .text).primaryKey()
                table.column("title", .text).notNull()
                table.column("content", .text).notNull()
                table.column("folder_id", .text)
                table.column("tags", .text).notNull() // JSON array
                table.column("is_pinned", .boolean).notNull().defaults(to: false)
                table.column("is_archived", .boolean).notNull().defaults(to: false)
                table.column("is_deleted", .boolean).notNull().defaults(to: false)
                table.column("created_at", .datetime).notNull()
                table.column("updated_at", .datetime).notNull()
                table.column("synced_at", .datetime)
                table.column("sync_status", .text).notNull().defaults(to: "synced")
                table.column("sync_error", .text)
                table.column("local_audio_path", .text)
            }

            // Folders table
            try database.create(table: "folders") { table in
                table.column("id", .text).primaryKey()
                table.column("name", .text).notNull()
                table.column("emoji", .text)
                table.column("color", .text)
                table.column("parent_id", .text)
                table.column("sort_order", .integer).notNull().defaults(to: 0)
                table.column("created_at", .datetime).notNull()
                table.column("updated_at", .datetime).notNull()
                table.column("sync_status", .text).notNull().defaults(to: "synced")
                table.column("sync_error", .text)
                table.column("is_local_deleted", .boolean).notNull().defaults(to: false)
            }

            // Actions table
            try database.create(table: "actions") { table in
                table.column("id", .text).primaryKey()
                table.column("note_id", .text).notNull().references("notes", column: "id", onDelete: .cascade)
                table.column("action_type", .text).notNull()
                table.column("status", .text).notNull()
                table.column("priority", .text).notNull()
                table.column("title", .text).notNull()
                table.column("description", .text)
                table.column("scheduled_date", .datetime)
                table.column("scheduled_end_date", .datetime)
                table.column("location", .text)
                table.column("attendees", .text).notNull() // JSON array
                table.column("email_to", .text)
                table.column("email_subject", .text)
                table.column("email_body", .text)
                table.column("external_id", .text)
                table.column("external_service", .text)
                table.column("external_url", .text)
                table.column("created_at", .datetime).notNull()
                table.column("executed_at", .datetime)
                table.column("sync_status", .text).notNull().defaults(to: "synced")
                table.column("sync_error", .text)
            }

            // Sync queue table
            try database.create(table: "sync_queue") { table in
                table.autoIncrementingPrimaryKey("id")
                table.column("operation", .text).notNull() // "create", "update", "delete"
                table.column("entity_type", .text).notNull() // "note", "folder", "action"
                table.column("entity_id", .text).notNull()
                table.column("payload", .text).notNull() // JSON data
                table.column("created_at", .datetime).notNull()
                table.column("attempts", .integer).notNull().defaults(to: 0)
                table.column("last_error", .text)
            }

            // Indexes for performance
            try database.create(index: "notes_folder_id_idx", on: "notes", columns: ["folder_id"])
            try database.create(index: "notes_sync_status_idx", on: "notes", columns: ["sync_status"])
            try database.create(index: "notes_created_at_idx", on: "notes", columns: ["created_at"])
            try database.create(index: "folders_parent_id_idx", on: "folders", columns: ["parent_id"])
            try database.create(index: "actions_note_id_idx", on: "actions", columns: ["note_id"])
            try database.create(index: "actions_sync_status_idx", on: "actions", columns: ["sync_status"])
            try database.create(index: "sync_queue_entity_idx", on: "sync_queue", columns: ["entity_type", "entity_id"])
            try database.create(index: "sync_queue_created_at_idx", on: "sync_queue", columns: ["created_at"])
        }

        try migrator.migrate(database)
        logger.info("Database migrations applied successfully")
    }
}

// MARK: - Database Errors

enum DatabaseError: LocalizedError {
    case notInitialized
    case fileDirectoryNotFound
    case migrationFailed(String)
    case queryFailed(String)

    var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "Database is not initialized"
        case .fileDirectoryNotFound:
            return "Application support directory not found"
        case .migrationFailed(let message):
            return "Migration failed: \(message)"
        case .queryFailed(let message):
            return "Query failed: \(message)"
        }
    }
}

// MARK: - Sync Status Database Mapping

extension SyncStatus {
    var databaseValue: String {
        return self.rawValue
    }

    static func fromDatabase(_ value: String) -> SyncStatus {
        return SyncStatus(rawValue: value) ?? .error
    }
}
