//
//  NoteModels.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Aligned with backend: app/schemas/note_schemas.py
//

import Foundation

// MARK: - Note Response

struct NoteResponse: Codable, Identifiable, Equatable {
    let id: UUID
    let title: String
    let transcript: String
    let summary: String?
    let duration: Int?
    let audioUrl: String?
    let folderId: UUID?
    let folderName: String?
    let tags: [String]
    let isPinned: Bool
    let isArchived: Bool
    let aiProcessed: Bool
    let actions: [ActionResponse]
    let createdAt: Date
    let updatedAt: Date

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case transcript
        case summary
        case duration
        case audioUrl = "audio_url"
        case folderId = "folder_id"
        case folderName = "folder_name"
        case tags
        case isPinned = "is_pinned"
        case isArchived = "is_archived"
        case aiProcessed = "ai_processed"
        case actions
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    // MARK: - Computed Properties

    var excerpt: String {
        let maxLength = 100
        if transcript.count <= maxLength {
            return transcript
        }
        let index = transcript.index(transcript.startIndex, offsetBy: maxLength)
        return String(transcript[..<index]) + "..."
    }

    var wordCount: Int {
        transcript.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.count
    }

    var readingTime: String {
        let wordsPerMinute = 200
        let minutes = max(1, wordCount / wordsPerMinute)
        return minutes == 1 ? "1 min read" : "\(minutes) min read"
    }

    var hasAudio: Bool {
        audioUrl != nil && !audioUrl!.isEmpty
    }

    var hasFolder: Bool {
        folderId != nil
    }

    var hasActions: Bool {
        !actions.isEmpty
    }

    var pendingActionCount: Int {
        actions.filter { $0.isPending }.count
    }

    // MARK: - Equatable

    static func == (lhs: NoteResponse, rhs: NoteResponse) -> Bool {
        lhs.id == rhs.id && lhs.updatedAt == rhs.updatedAt
    }
}

// MARK: - Note List Item

struct NoteListItem: Codable, Identifiable, Equatable {
    let id: UUID
    let title: String
    let preview: String
    let duration: Int?
    let folderId: UUID?
    let tags: [String]
    let isPinned: Bool
    let actionCount: Int
    let calendarCount: Int
    let emailCount: Int
    let reminderCount: Int
    let createdAt: Date

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case preview
        case duration
        case folderId = "folder_id"
        case tags
        case isPinned = "is_pinned"
        case actionCount = "action_count"
        case calendarCount = "calendar_count"
        case emailCount = "email_count"
        case reminderCount = "reminder_count"
        case createdAt = "created_at"
    }

    // MARK: - Computed Properties

    var hasActions: Bool {
        actionCount > 0
    }

    var totalActionCount: Int {
        calendarCount + emailCount + reminderCount
    }

    var hasFolder: Bool {
        folderId != nil
    }

    var hasDuration: Bool {
        duration != nil && duration! > 0
    }

    var durationFormatted: String {
        guard let duration = duration, duration > 0 else {
            return ""
        }

        let minutes = duration / 60
        let seconds = duration % 60

        if minutes > 0 {
            return "\(minutes)m \(seconds)s"
        } else {
            return "\(seconds)s"
        }
    }

    // MARK: - Equatable

    static func == (lhs: NoteListItem, rhs: NoteListItem) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Note List Response

struct NoteListResponse: Codable, Equatable {
    let items: [NoteListItem]
    let total: Int
    let page: Int
    let perPage: Int
    let pages: Int

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case items
        case total
        case page
        case perPage = "per_page"
        case pages
    }

    // MARK: - Computed Properties

    var hasMorePages: Bool {
        page < pages
    }

    var isLastPage: Bool {
        page >= pages
    }

    var isFirstPage: Bool {
        page == 1
    }

    // MARK: - Equatable

    static func == (lhs: NoteListResponse, rhs: NoteListResponse) -> Bool {
        lhs.items == rhs.items &&
        lhs.total == rhs.total &&
        lhs.page == rhs.page &&
        lhs.perPage == rhs.perPage &&
        lhs.pages == rhs.pages
    }
}

// MARK: - Note Create Request

struct NoteCreateRequest: Codable {
    let title: String
    let transcript: String
    let folderId: UUID?
    let tags: [String]

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case title
        case transcript
        case folderId = "folder_id"
        case tags
    }
}

// MARK: - Note Update Request

struct NoteUpdateRequest: Codable {
    let title: String?
    let transcript: String?
    let folderId: UUID?
    let tags: [String]?
    let isPinned: Bool?
    let isArchived: Bool?

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case title
        case transcript
        case folderId = "folder_id"
        case tags
        case isPinned = "is_pinned"
        case isArchived = "is_archived"
    }
}

// MARK: - Note Search Params

struct NoteSearchParams: Codable {
    let q: String?
    let folderId: UUID?
    let tags: [String]?
    let isPinned: Bool?
    let isArchived: Bool?
    let startDate: Date?
    let endDate: Date?
    let page: Int
    let perPage: Int

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case q
        case folderId = "folder_id"
        case tags
        case isPinned = "is_pinned"
        case isArchived = "is_archived"
        case startDate = "start_date"
        case endDate = "end_date"
        case page
        case perPage = "per_page"
    }

    init(
        q: String? = nil,
        folderId: UUID? = nil,
        tags: [String]? = nil,
        isPinned: Bool? = nil,
        isArchived: Bool? = nil,
        startDate: Date? = nil,
        endDate: Date? = nil,
        page: Int = 1,
        perPage: Int = 20
    ) {
        self.q = q
        self.folderId = folderId
        self.tags = tags
        self.isPinned = isPinned
        self.isArchived = isArchived
        self.startDate = startDate
        self.endDate = endDate
        self.page = page
        self.perPage = perPage
    }
}

// MARK: - Unified Search Response

struct UnifiedSearchResponse: Codable {
    let folders: [FolderResponse]
    let notes: [NoteListItem]
}

// MARK: - Mock Data for Testing

#if DEBUG
extension NoteResponse {
    static let mock = NoteResponse(
        id: UUID(),
        title: "Team Meeting Notes",
        transcript: "Discussed the Q1 roadmap and assigned action items to team members.",
        summary: "Q1 roadmap discussion",
        duration: 180,
        audioUrl: "https://example.com/audio.mp3",
        folderId: UUID(),
        folderName: "Work",
        tags: ["meeting", "work"],
        isPinned: true,
        isArchived: false,
        aiProcessed: true,
        actions: [],
        createdAt: Date(),
        updatedAt: Date()
    )
}

extension NoteListItem {
    static let mock = NoteListItem(
        id: UUID(),
        title: "Shopping List",
        preview: "Milk, eggs, bread, butter...",
        duration: 45,
        folderId: nil,
        tags: ["personal"],
        isPinned: false,
        actionCount: 0,
        calendarCount: 0,
        emailCount: 0,
        reminderCount: 0,
        createdAt: Date()
    )
}

extension NoteListResponse {
    static let mock = NoteListResponse(
        items: [.mock],
        total: 1,
        page: 1,
        perPage: 20,
        pages: 1
    )
}
#endif
