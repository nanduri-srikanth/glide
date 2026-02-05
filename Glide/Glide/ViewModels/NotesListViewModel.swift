//
//  NotesListViewModel.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation
import SwiftUI

/// View Model for the notes list screen
@MainActor
class NotesListViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published var notes: [Note] = []
    @Published var filteredNotes: [Note] = []
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var searchText: String = ""
    @Published var selectedFolder: Folder?
    @Published var sortOption: SortOption = .updatedAt

    // MARK: - Types

    enum SortOption: String, CaseIterable {
        case createdAt = "Created Date"
        case updatedAt = "Updated Date"
        case title = "Title"

        var displayName: String { rawValue }
    }

    // MARK: - Dependencies

    private let notesRepository: NotesRepositoryProtocol
    private let logger: LoggerServiceProtocol

    // MARK: - Initialization

    init(
        notesRepository: NotesRepositoryProtocol,
        logger: LoggerServiceProtocol
    ) {
        self.notesRepository = notesRepository
        self.logger = logger

        // Load notes on initialization
        Task {
            await loadNotes()
        }
    }

    // MARK: - Computed Properties

    var hasNotes: Bool {
        !notes.isEmpty
    }

    var isEmpty: Bool {
        notes.isEmpty && !isLoading
    }

    // MARK: - Actions

    func loadNotes() async {
        isLoading = true
        errorMessage = nil

        do {
            logger.info("Loading notes", file: #file, function: #function, line: #line)
            let fetchedNotes = try await notesRepository.fetchNotes()

            await MainActor.run {
                self.notes = fetchedNotes
                self.applyFilters()
                self.isLoading = false
            }

            logger.info("Loaded \(fetchedNotes.count) notes", file: #file, function: #function, line: #line)
        } catch {
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = error.localizedDescription
                logger.error("Failed to load notes: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func deleteNote(_ note: Note) async {
        do {
            logger.info("Deleting note \(note.id)", file: #file, function: #function, line: #line)
            try await notesRepository.deleteNote(id: note.id)

            await MainActor.run {
                notes.removeAll { $0.id == note.id }
                applyFilters()
            }

            logger.info("Note deleted successfully", file: #file, function: #function, line: #line)
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                logger.error("Failed to delete note: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func togglePin(_ note: Note) async {
        var updatedNote = note
        updatedNote.isPinned.toggle()

        do {
            _ = try await notesRepository.updateNote(updatedNote)

            await MainActor.run {
                if let index = notes.firstIndex(where: { $0.id == note.id }) {
                    notes[index] = updatedNote
                    applyFilters()
                }
            }
        } catch {
            await MainActor.run {
                errorMessage = error.localizedDescription
                logger.error("Failed to update note: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func refresh() {
        Task {
            await loadNotes()
        }
    }

    // MARK: - Filtering

    func applyFilters() {
        filteredNotes = notes

        // Apply search filter
        if !searchText.isEmpty {
            filteredNotes = filteredNotes.filter { note in
                note.title.localizedCaseInsensitiveContains(searchText) ||
                note.content.localizedCaseInsensitiveContains(searchText) ||
                note.tags.contains { $0.localizedCaseInsensitiveContains(searchText) }
            }
        }

        // Apply folder filter
        if let folder = selectedFolder {
            filteredNotes = filteredNotes.filter { $0.folderId == folder.id }
        }

        // Apply sorting
        sortNotes()
    }

    private func sortNotes() {
        switch sortOption {
        case .createdAt:
            filteredNotes.sort { $0.createdAt > $1.createdAt }
        case .updatedAt:
            filteredNotes.sort { $0.updatedAt > $1.updatedAt }
        case .title:
            filteredNotes.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        }

        // Move pinned notes to top
        filteredNotes.sort { $0.isPinned && !$1.isPinned }
    }

    func updateSearchText(_ text: String) {
        searchText = text
        applyFilters()
    }
}
