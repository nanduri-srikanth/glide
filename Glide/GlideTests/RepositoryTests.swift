//
//  RepositoryTests.swift
//  GlideTests
//
//  Created by Claude on 2/5/26.
//  Unit tests for local SQLite repositories
//

import XCTest
import GRDB
@testable import Glide

// MARK: - Test Database Setup

class TestDatabaseSetup {
    static func createInMemoryDatabase() throws -> DatabaseQueue {
        var config = Configuration()
        config.qtasynchronous = false // Disable WAL for tests
        let database = try DatabaseQueue(configuration: config)

        // Setup schema
        try database.write { database in
            // Notes table
            try database.create(table: "notes") { table in
                table.column("id", .text).primaryKey()
                table.column("title", .text).notNull()
                table.column("content", .text).notNull()
                table.column("folder_id", .text)
                table.column("tags", .text).notNull()
                table.column("is_pinned", .boolean).notNull().defaults(to: false)
                table.column("is_archived", .boolean).notNull().defaults(to: false)
                table.column("is_deleted", .boolean).notNull().defaults(to: false)
                table.column("created_at", .datetime).notNull()
                table.column("updated_at", .datetime).notNull()
                table.column("synced_at", .datetime)
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
                table.column("is_local_deleted", .boolean).notNull().defaults(to: false)
            }

            // Actions table
            try database.create(table: "actions") { table in
                table.column("id", .text).primaryKey()
                table.column("note_id", .text).notNull()
                table.column("action_type", .text).notNull()
                table.column("status", .text).notNull()
                table.column("priority", .text).notNull()
                table.column("title", .text).notNull()
                table.column("description", .text)
                table.column("scheduled_date", .datetime)
                table.column("scheduled_end_date", .datetime)
                table.column("location", .text)
                table.column("attendees", .text).notNull()
                table.column("email_to", .text)
                table.column("email_subject", .text)
                table.column("email_body", .text)
                table.column("external_id", .text)
                table.column("external_service", .text)
                table.column("external_url", .text)
                table.column("created_at", .datetime).notNull()
                table.column("executed_at", .datetime)
            }

            // Sync queue table
            try database.create(table: "sync_queue") { table in
                table.autoIncrementingPrimaryKey("id")
                table.column("operation", .text).notNull()
                table.column("entity_type", .text).notNull()
                table.column("entity_id", .text).notNull()
                table.column("payload", .text).notNull()
                table.column("created_at", .datetime).notNull()
                table.column("attempts", .integer).notNull().defaults(to: 0)
                table.column("last_error", .text)
            }
        }

        return database
    }
}

// MARK: - Note Repository Tests

class LocalNoteRepositoryTests: XCTestCase {

    var database: DatabaseQueue!
    var repository: LocalNoteRepository!

    override func setUp() async throws {
        database = try TestDatabaseSetup.createInMemoryDatabase()
        repository = LocalNoteRepository(database: database)
    }

    override func tearDown() async throws {
        database = nil
        repository = nil
    }

    func testInsertNote() throws {
        let note = Note(
            id: "test-note-1",
            title: "Test Note",
            content: "This is a test note",
            tags: ["test", "unit"],
            createdAt: Date(),
            updatedAt: Date()
        )

        try repository.insert(note)
        let fetched = try repository.fetchById(id: "test-note-1")

        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.title, "Test Note")
        XCTAssertEqual(fetched?.content, "This is a test note")
        XCTAssertEqual(fetched?.tags.count, 2)
    }

    func testFetchAllNotes() throws {
        let note1 = Note(id: "1", title: "Note 1", content: "Content 1", tags: [], createdAt: Date(), updatedAt: Date())
        let note2 = Note(id: "2", title: "Note 2", content: "Content 2", tags: [], createdAt: Date(), updatedAt: Date())

        try repository.insert(note1)
        try repository.insert(note2)

        let notes = try repository.fetchAll()
        XCTAssertEqual(notes.count, 2)
    }

    func testUpdateNote() throws {
        let note = Note(
            id: "test-note-1",
            title: "Original Title",
            content: "Original Content",
            tags: [],
            createdAt: Date(),
            updatedAt: Date()
        )

        try repository.insert(note)

        let updatedNote = Note(
            id: "test-note-1",
            title: "Updated Title",
            content: "Updated Content",
            tags: ["updated"],
            createdAt: note.createdAt,
            updatedAt: Date()
        )

        try repository.update(updatedNote)
        let fetched = try repository.fetchById(id: "test-note-1")

        XCTAssertEqual(fetched?.title, "Updated Title")
        XCTAssertEqual(fetched?.content, "Updated Content")
    }

    func testDeleteNote() throws {
        let note = Note(
            id: "test-note-1",
            title: "To Delete",
            content: "This will be deleted",
            tags: [],
            createdAt: Date(),
            updatedAt: Date()
        )

        try repository.insert(note)
        try repository.delete(id: "test-note-1")

        let fetched = try repository.fetchById(id: "test-note-1")
        XCTAssertNotNil(fetched) // Note should still exist (soft delete)
        XCTAssertTrue(fetched!.isDeleted)
    }

    func testSearchNotes() throws {
        let note1 = Note(id: "1", title: "Meeting Notes", content: "Discussion about project", tags: [], createdAt: Date(), updatedAt: Date())
        let note2 = Note(id: "2", title: "Shopping List", content: "Milk, Eggs, Bread", tags: [], createdAt: Date(), updatedAt: Date())

        try repository.insert(note1)
        try repository.insert(note2)

        let results = try repository.search(query: "meeting")
        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results.first?.title, "Meeting Notes")
    }

    func testCountNotes() throws {
        let note1 = Note(id: "1", title: "Note 1", content: "Content", tags: [], createdAt: Date(), updatedAt: Date())
        let note2 = Note(id: "2", title: "Note 2", content: "Content", tags: [], createdAt: Date(), updatedAt: Date())

        try repository.insert(note1)
        try repository.insert(note2)

        XCTAssertEqual(try repository.count(), 2)
    }
}

// MARK: - Folder Repository Tests

class LocalFolderRepositoryTests: XCTestCase {

    var database: DatabaseQueue!
    var repository: LocalFolderRepository!

    override func setUp() async throws {
        database = try TestDatabaseSetup.createInMemoryDatabase()
        repository = LocalFolderRepository(database: database)
    }

    override func tearDown() async throws {
        database = nil
        repository = nil
    }

    func testInsertFolder() throws {
        let folder = Folder(
            id: "test-folder-1",
            name: "Test Folder",
            emoji: "📁",
            color: "#3B82F6",
            sortOrder: 0,
            createdAt: Date(),
            updatedAt: Date()
        )

        try repository.insert(folder)
        let fetched = try repository.fetchById(id: "test-folder-1")

        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.name, "Test Folder")
        XCTAssertEqual(fetched?.emoji, "📁")
        XCTAssertEqual(fetched?.color, "#3B82F6")
    }

    func testFetchRootFolders() throws {
        let root1 = Folder(id: "1", name: "Root 1", sortOrder: 0, createdAt: Date(), updatedAt: Date())
        let root2 = Folder(id: "2", name: "Root 2", sortOrder: 1, createdAt: Date(), updatedAt: Date())
        let child = Folder(id: "3", name: "Child", parentId: "1", sortOrder: 0, createdAt: Date(), updatedAt: Date())

        try repository.insert(root1)
        try repository.insert(root2)
        try repository.insert(child)

        let roots = try repository.fetchRootFolders()
        XCTAssertEqual(roots.count, 2)
    }

    func testFetchChildren() throws {
        let parent = Folder(id: "parent-1", name: "Parent", sortOrder: 0, createdAt: Date(), updatedAt: Date())
        let child1 = Folder(id: "child-1", name: "Child 1", parentId: "parent-1", sortOrder: 0, createdAt: Date(), updatedAt: Date())
        let child2 = Folder(id: "child-2", name: "Child 2", parentId: "parent-1", sortOrder: 1, createdAt: Date(), updatedAt: Date())

        try repository.insert(parent)
        try repository.insert(child1)
        try repository.insert(child2)

        let children = try repository.fetchChildren(parentId: "parent-1")
        XCTAssertEqual(children.count, 2)
    }

    func testMoveFolder() throws {
        let folder = Folder(id: "folder-1", name: "Movable", sortOrder: 0, createdAt: Date(), updatedAt: Date())
        try repository.insert(folder)

        try repository.move(folderId: "folder-1", toParentId: "new-parent", newSortOrder: 5)

        let fetched = try repository.fetchById(id: "folder-1")
        XCTAssertEqual(fetched?.parentId, "new-parent")
        XCTAssertEqual(fetched?.sortOrder, 5)
    }

    func testFetchHierarchy() throws {
        let parent = Folder(id: "parent-1", name: "Parent", sortOrder: 0, createdAt: Date(), updatedAt: Date())
        let child = Folder(id: "child-1", name: "Child", parentId: "parent-1", sortOrder: 0, createdAt: Date(), updatedAt: Date())
        let grandchild = Folder(id: "grandchild-1", name: "Grandchild", parentId: "child-1", sortOrder: 0, createdAt: Date(), updatedAt: Date())

        try repository.insert(parent)
        try repository.insert(child)
        try repository.insert(grandchild)

        let hierarchy = try repository.fetchHierarchy()
        XCTAssertEqual(hierarchy.count, 1) // One root
        XCTAssertEqual(hierarchy.first?.children.count, 1) // One child
        XCTAssertEqual(hierarchy.first?.children.first?.children.count, 1) // One grandchild
    }
}

// MARK: - Action Repository Tests

class LocalActionRepositoryTests: XCTestCase {

    var database: DatabaseQueue!
    var repository: LocalActionRepository!

    override func setUp() async throws {
        database = try TestDatabaseSetup.createInMemoryDatabase()
        repository = LocalActionRepository(database: database)
    }

    override func tearDown() async throws {
        database = nil
        repository = nil
    }

    func testInsertAction() throws {
        let action = Action(
            id: "test-action-1",
            noteId: "note-1",
            actionType: .reminder,
            status: .pending,
            priority: .high,
            title: "Test Reminder",
            createdAt: Date()
        )

        try repository.insert(action)
        let fetched = try repository.fetchById(id: "test-action-1")

        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.title, "Test Reminder")
        XCTAssertEqual(fetched?.actionType, .reminder)
        XCTAssertEqual(fetched?.priority, .high)
    }

    func testFetchByNote() throws {
        let action1 = Action(id: "1", noteId: "note-1", actionType: .reminder, status: .pending, priority: .medium, title: "Action 1", createdAt: Date())
        let action2 = Action(id: "2", noteId: "note-1", actionType: .calendar, status: .pending, priority: .high, title: "Action 2", createdAt: Date())
        let action3 = Action(id: "3", noteId: "note-2", actionType: .email, status: .pending, priority: .low, title: "Action 3", createdAt: Date())

        try repository.insert(action1)
        try repository.insert(action2)
        try repository.insert(action3)

        let note1Actions = try repository.fetchByNote(noteId: "note-1")
        XCTAssertEqual(note1Actions.count, 2)

        let note2Actions = try repository.fetchByNote(noteId: "note-2")
        XCTAssertEqual(note2Actions.count, 1)
    }

    func testFetchByType() throws {
        let action1 = Action(id: "1", noteId: "note-1", actionType: .calendar, status: .pending, priority: .medium, title: "Meeting", createdAt: Date())
        let action2 = Action(id: "2", noteId: "note-1", actionType: .reminder, status: .pending, priority: .high, title: "Call", createdAt: Date())
        let action3 = Action(id: "3", noteId: "note-2", actionType: .calendar, status: .pending, priority: .low, title: "Event", createdAt: Date())

        try repository.insert(action1)
        try repository.insert(action2)
        try repository.insert(action3)

        let calendarActions = try repository.fetchByType(actionType: .calendar)
        XCTAssertEqual(calendarActions.count, 2)

        let reminderActions = try repository.fetchByType(actionType: .reminder)
        XCTAssertEqual(reminderActions.count, 1)
    }

    func testFetchPending() throws {
        let action1 = Action(id: "1", noteId: "note-1", actionType: .reminder, status: .pending, priority: .high, title: "Pending", createdAt: Date())
        let action2 = Action(id: "2", noteId: "note-1", actionType: .calendar, status: .executed, priority: .medium, title: "Done", createdAt: Date())
        let action3 = Action(id: "3", noteId: "note-2", actionType: .email, status: .created, priority: .low, title: "Created", createdAt: Date())

        try repository.insert(action1)
        try repository.insert(action2)
        try repository.insert(action3)

        let pending = try repository.fetchPending()
        XCTAssertEqual(pending.count, 2) // pending + created
    }

    func testDeleteAction() throws {
        let action = Action(
            id: "test-action-1",
            noteId: "note-1",
            actionType: .reminder,
            status: .pending,
            priority: .high,
            title: "To Delete",
            createdAt: Date()
        )

        try repository.insert(action)
        try repository.delete(id: "test-action-1")

        let fetched = try repository.fetchById(id: "test-action-1")
        XCTAssertNil(fetched) // Actions are permanently deleted
    }

    func testCountByNote() throws {
        let action1 = Action(id: "1", noteId: "note-1", actionType: .reminder, status: .pending, priority: .medium, title: "A1", createdAt: Date())
        let action2 = Action(id: "2", noteId: "note-1", actionType: .calendar, status: .pending, priority: .high, title: "A2", createdAt: Date())
        let action3 = Action(id: "3", noteId: "note-2", actionType: .email, status: .pending, priority: .low, title: "A3", createdAt: Date())

        try repository.insert(action1)
        try repository.insert(action2)
        try repository.insert(action3)

        XCTAssertEqual(try repository.countByNote(noteId: "note-1"), 2)
        XCTAssertEqual(try repository.countByNote(noteId: "note-2"), 1)
    }
}

// MARK: - Sync Queue Repository Tests

class SyncQueueRepositoryTests: XCTestCase {

    var database: DatabaseQueue!
    var repository: SyncQueueRepository!

    override func setUp() async throws {
        database = try TestDatabaseSetup.createInMemoryDatabase()
        repository = SyncQueueRepository(database: database)
    }

    override func tearDown() async throws {
        database = nil
        repository = nil
    }

    func testEnqueueEntry() throws {
        let payload = ["title": "Test", "content": "Content"]
        try repository.enqueue(operation: .create, entityType: .note, entityId: "note-1", payload: payload)

        let entries = try repository.fetchAll()
        XCTAssertEqual(entries.count, 1)
        XCTAssertEqual(entries.first?.entityId, "note-1")
        XCTAssertEqual(entries.first?.operation, .create)
    }

    func testFetchByEntityType() throws {
        try repository.enqueue(operation: .create, entityType: .note, entityId: "note-1", payload: ["data": "1"])
        try repository.enqueue(operation: .update, entityType: .folder, entityId: "folder-1", payload: ["data": "2"])
        try repository.enqueue(operation: .delete, entityType: .note, entityId: "note-2", payload: ["data": "3"])

        let noteEntries = try repository.fetchByEntityType(entityType: .note)
        XCTAssertEqual(noteEntries.count, 2)

        let folderEntries = try repository.fetchByEntityType(entityType: .folder)
        XCTAssertEqual(folderEntries.count, 1)
    }

    func testMarkSuccessful() throws {
        try repository.enqueue(operation: .create, entityType: .note, entityId: "note-1", payload: ["data": "1"])

        var entries = try repository.fetchAll()
        XCTAssertEqual(entries.count, 1)

        let entryId = entries.first!.id
        try repository.markSuccessful(id: entryId)

        entries = try repository.fetchAll()
        XCTAssertEqual(entries.count, 0) // Entry removed after success
    }

    func testMarkFailed() throws {
        try repository.enqueue(operation: .create, entityType: .note, entityId: "note-1", payload: ["data": "1"])

        var entries = try repository.fetchAll()
        let entryId = entries.first!.id

        try repository.markFailed(id: entryId, error: NSError(domain: "test", code: 1, userInfo: [NSLocalizedDescriptionKey: "Test error"]))

        entries = try repository.fetchAll()
        XCTAssertEqual(entries.count, 1) // Entry still in queue
        XCTAssertEqual(entries.first?.attempts, 1)
        XCTAssertNotNil(entries.first?.lastError)
    }

    func testClearEntity() throws {
        try repository.enqueue(operation: .create, entityType: .note, entityId: "note-1", payload: ["data": "1"])
        try repository.enqueue(operation: .update, entityType: .note, entityId: "note-1", payload: ["data": "2"])
        try repository.enqueue(operation: .update, entityType: .note, entityId: "note-2", payload: ["data": "3"])

        try repository.clearEntity(entityType: .note, entityId: "note-1")

        let entries = try repository.fetchAll()
        XCTAssertEqual(entries.count, 1)
        XCTAssertEqual(entries.first?.entityId, "note-2")
    }

    func testCount() throws {
        XCTAssertEqual(try repository.count(), 0)

        try repository.enqueue(operation: .create, entityType: .note, entityId: "note-1", payload: ["data": "1"])
        try repository.enqueue(operation: .create, entityType: .note, entityId: "note-2", payload: ["data": "2"])

        XCTAssertEqual(try repository.count(), 2)
    }
}
