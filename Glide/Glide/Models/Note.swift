//
//  Note.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

/// Note model representing a note in the system
struct Note: Codable, Identifiable, Equatable {

    // MARK: - Properties

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

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case content
        case folderId = "folder_id"
        case tags
        case isPinned = "is_pinned"
        case isArchived = "is_archived"
        case isDeleted = "is_deleted"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case syncedAt = "synced_at"
    }

    // MARK: - Computed Properties

    var excerpt: String {
        let maxLength = 100
        if content.count <= maxLength {
            return content
        }
        let index = content.index(content.startIndex, offsetBy: maxLength)
        return String(content[..<index]) + "..."
    }

    var wordCount: Int {
        content.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.count
    }

    var readingTime: String {
        let wordsPerMinute = 200
        let minutes = max(1, wordCount / wordsPerMinute)
        return minutes == 1 ? "1 min read" : "\(minutes) min read"
    }

    // MARK: - Initialization

    init(
        id: String = UUID().uuidString,
        title: String,
        content: String,
        folderId: String? = nil,
        tags: [String] = [],
        isPinned: Bool = false,
        isArchived: Bool = false,
        isDeleted: Bool = false,
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        syncedAt: Date? = nil
    ) {
        self.id = id
        self.title = title
        self.content = content
        self.folderId = folderId
        self.tags = tags
        self.isPinned = isPinned
        self.isArchived = isArchived
        self.isDeleted = isDeleted
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.syncedAt = syncedAt
    }

    // MARK: - Equatable

    static func == (lhs: Note, rhs: Note) -> Bool {
        lhs.id == rhs.id &&
        lhs.updatedAt == rhs.updatedAt
    }
}

// MARK: - Mock Data for Testing

#if DEBUG
extension Note {
    static let mock = Note(
        id: "1",
        title: "Sample Note",
        content: "This is a sample note with some content.",
        tags: ["sample", "test"]
    )

    static let mockNotes = [
        Note(
            id: "1",
            title: "Meeting Notes",
            content: "Discuss project timeline and deliverables.",
            tags: ["work", "meeting"],
            isPinned: true
        ),
        Note(
            id: "2",
            title: "Shopping List",
            content: "Milk, Eggs, Bread, Butter",
            tags: ["personal"]
        ),
        Note(
            id: "3",
            title: "Book Recommendations",
            content: "1. Atomic Habits\n2. Deep Work\n3. The Pragmatic Programmer",
            tags: ["books", "learning"]
        )
    ]
}
#endif
