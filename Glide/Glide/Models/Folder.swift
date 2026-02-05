//
//  Folder.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

/// Folder model for organizing notes
struct Folder: Codable, Identifiable, Equatable {

    // MARK: - Properties

    let id: String
    var name: String
    var emoji: String?
    var color: String?
    var parentId: String?
    var sortOrder: Int
    var createdAt: Date
    var updatedAt: Date

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case emoji
        case color
        case parentId = "parent_id"
        case sortOrder = "sort_order"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    // MARK: - Initialization

    init(
        id: String = UUID().uuidString,
        name: String,
        emoji: String? = nil,
        color: String? = nil,
        parentId: String? = nil,
        sortOrder: Int = 0,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.emoji = emoji
        self.color = color
        self.parentId = parentId
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    // MARK: - Equatable

    static func == (lhs: Folder, rhs: Folder) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Mock Data for Testing

#if DEBUG
extension Folder {
    static let mock = Folder(
        id: "1",
        name: "Personal",
        emoji: "🏠",
        color: "#3B82F6"
    )

    static let mockFolders = [
        Folder(
            id: "1",
            name: "Personal",
            emoji: "🏠",
            color: "#3B82F6",
            sortOrder: 0
        ),
        Folder(
            id: "2",
            name: "Work",
            emoji: "💼",
            color: "#10B981",
            sortOrder: 1
        ),
        Folder(
            id: "3",
            name: "Ideas",
            emoji: "💡",
            color: "#F59E0B",
            sortOrder: 2
        )
    ]
}
#endif
