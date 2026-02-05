//
//  FoldersViewModel.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation
import SwiftUI
import Combine

/// View Model for folders sidebar
@MainActor
class FoldersViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published var folders: [FolderResponse] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var selectedFolderId: UUID? = nil
    @Published var expandedFolderIds: Set<UUID> = []

    // MARK: - Dependencies

    private let foldersRepository: FoldersRepositoryProtocol
    private let logger: LoggerServiceProtocol

    // MARK: - Initialization

    init(
        foldersRepository: FoldersRepositoryProtocol,
        logger: LoggerServiceProtocol
    ) {
        self.foldersRepository = foldersRepository
        self.logger = logger
    }

    // MARK: - Computed Properties

    var hasFolders: Bool {
        !folders.isEmpty
    }

    var isEmpty: Bool {
        folders.isEmpty && !isLoading
    }

    var allNotesSystemFolder: FolderResponse {
        FolderResponse(
            id: UUID(uuidString: "00000000-0000-0000-0000-000000000000")!,
            name: "All Notes",
            icon: "note.text",
            color: nil,
            isSystem: true,
            noteCount: folders.reduce(0) { $0 + $1.noteCount },
            sortOrder: -1,
            parentId: nil,
            depth: 0,
            children: [],
            createdAt: Date()
        )
    }

    // MARK: - Actions

    func loadFolders() async {
        isLoading = true
        errorMessage = nil

        do {
            logger.info("Loading folders", file: #file, function: #function, line: #line)
            let fetchedFolders = try await foldersRepository.fetchFolders()

            await MainActor.run {
                self.folders = fetchedFolders
                self.isLoading = false
            }

            logger.info("Loaded \(fetchedFolders.count) folders", file: #file, function: #function, line: #line)
        } catch {
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = error.localizedDescription
                logger.error("Failed to load folders: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func selectFolder(_ folder: FolderResponse) {
        selectedFolderId = folder.id
        logger.info("Selected folder: \(folder.name) (id: \(folder.id))", file: #file, function: #function, line: #line)
    }

    func deselectFolder() {
        selectedFolderId = nil
        logger.info("Deselected folder", file: #file, function: #function, line: #line)
    }

    func toggleExpanded(_ folderId: UUID) {
        if expandedFolderIds.contains(folderId) {
            expandedFolderIds.remove(folderId)
        } else {
            expandedFolderIds.insert(folderId)
        }
    }

    func refresh() {
        Task {
            await loadFolders()
        }
    }

    // MARK: - Helpers

    func isExpanded(_ folderId: UUID) -> Bool {
        expandedFolderIds.contains(folderId)
    }

    func isSelected(_ folderId: UUID) -> Bool {
        selectedFolderId == folderId
    }

    func totalNoteCount() -> Int {
        folders.reduce(0) { $0 + $1.noteCount }
    }
}
