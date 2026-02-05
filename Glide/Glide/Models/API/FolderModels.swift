//
//  FolderModels.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Aligned with backend: app/schemas/note_schemas.py
//

import Foundation
import SwiftUI

// MARK: - Folder Response

struct FolderResponse: Codable, Identifiable, Equatable {
    let id: UUID
    let name: String
    let icon: String
    let color: String?
    let isSystem: Bool
    let noteCount: Int
    let sortOrder: Int
    let parentId: UUID?
    let depth: Int
    let children: [FolderResponse]
    let createdAt: Date

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case icon
        case color
        case isSystem = "is_system"
        case noteCount = "note_count"
        case sortOrder = "sort_order"
        case parentId = "parent_id"
        case depth
        case children
        case createdAt = "created_at"
    }

    // MARK: - Computed Properties

    var hasNotes: Bool {
        noteCount > 0
    }

    var hasChildren: Bool {
        !children.isEmpty
    }

    var hasColor: Bool {
        color != nil && !color!.isEmpty
    }

    var sfSymbolName: String {
        // Convert SF Symbol name if needed
        icon.isEmpty ? "folder.fill" : icon
    }

    var folderColor: Color? {
        guard let colorHex = color else { return nil }
        return Color(hex: colorHex)
    }

    var displayPath: String {
        var path = name
        var current = self
        // Could build full path here if needed
        return path
    }

    // MARK: - Methods

    func allDescendants() -> [FolderResponse] {
        var all = children
        for child in children {
            all.append(contentsOf: child.allDescendants())
        }
        return all
    }

    func findChild(id: UUID) -> FolderResponse? {
        if children.contains(where: { $0.id == id }) {
            return children.first { $0.id == id }
        }
        for child in children {
            if let found = child.findChild(id: id) {
                return found
            }
        }
        return nil
    }

    // MARK: - Equatable

    static func == (lhs: FolderResponse, rhs: FolderResponse) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Folder Create Request

struct FolderCreateRequest: Codable {
    let name: String
    let icon: String
    let color: String?
    let parentId: UUID?

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case name
        case icon
        case color
        case parentId = "parent_id"
    }

    init(
        name: String,
        icon: String = "folder.fill",
        color: String? = nil,
        parentId: UUID? = nil
    ) {
        self.name = name
        self.icon = icon
        self.color = color
        self.parentId = parentId
    }
}

// MARK: - Folder Update Request

struct FolderUpdateRequest: Codable {
    let name: String?
    let icon: String?
    let color: String?
    let sortOrder: Int?
    let parentId: UUID?

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case name
        case icon
        case color
        case sortOrder = "sort_order"
        case parentId = "parent_id"
    }

    init(
        name: String? = nil,
        icon: String? = nil,
        color: String? = nil,
        sortOrder: Int? = nil,
        parentId: UUID? = nil
    ) {
        self.name = name
        self.icon = icon
        self.color = color
        self.sortOrder = sortOrder
        self.parentId = parentId
    }
}

// MARK: - Folder Reorder Item

struct FolderReorderItem: Codable, Identifiable {
    let id: UUID
    let sortOrder: Int
    let parentId: UUID?

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case id
        case sortOrder = "sort_order"
        case parentId = "parent_id"
    }

    init(
        id: UUID,
        sortOrder: Int,
        parentId: UUID? = nil
    ) {
        self.id = id
        self.sortOrder = sortOrder
        self.parentId = parentId
    }
}

// MARK: - Folder Bulk Reorder

struct FolderBulkReorder: Codable {
    let folders: [FolderReorderItem]

    init(folders: [FolderReorderItem]) {
        self.folders = folders
    }
}

// MARK: - Mock Data for Testing

#if DEBUG
extension FolderResponse {
    static let mock = FolderResponse(
        id: UUID(),
        name: "Personal",
        icon: "folder.fill",
        color: "#3B82F6",
        isSystem: false,
        noteCount: 5,
        sortOrder: 0,
        parentId: nil,
        depth: 0,
        children: [],
        createdAt: Date()
    )

    static let mockWithChildren = FolderResponse(
        id: UUID(),
        name: "Work",
        icon: "briefcase.fill",
        color: "#10B981",
        isSystem: false,
        noteCount: 10,
        sortOrder: 1,
        parentId: nil,
        depth: 0,
        children: [
            FolderResponse(
                id: UUID(),
                name: "Projects",
                icon: "folder.fill",
                color: "#F59E0B",
                isSystem: false,
                noteCount: 3,
                sortOrder: 0,
                parentId: nil,
                depth: 1,
                children: [],
                createdAt: Date()
            )
        ],
        createdAt: Date()
    )
}
#endif
