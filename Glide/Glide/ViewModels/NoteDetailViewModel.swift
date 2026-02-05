//
//  NoteDetailViewModel.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation
import SwiftUI

/// View Model for note detail screen
@MainActor
class NoteDetailViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published var note: Note?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var isEditing: Bool = false

    // MARK: - Properties

    private let noteId: String
    private let notesRepository: NotesRepositoryProtocol
    private let logger: LoggerServiceProtocol

    // MARK: - Initialization

    init(
        noteId: String,
        notesRepository: NotesRepositoryProtocol,
        logger: LoggerServiceProtocol
    ) {
        self.noteId = noteId
        self.notesRepository = notesRepository
        self.logger = logger

        // Load note on initialization
        Task {
            await loadNote()
        }
    }

    // MARK: - Actions

    func loadNote() async {
        isLoading = true
        errorMessage = nil

        do {
            logger.info("Loading note \(noteId)", file: #file, function: #function, line: #line)
            let loadedNote = try await notesRepository.fetchNote(id: noteId)

            await MainActor.run {
                self.note = loadedNote
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = error.localizedDescription
                logger.error("Failed to load note: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func updateNote(_ updatedNote: Note) async {
        isLoading = true
        errorMessage = nil

        do {
            logger.info("Updating note \(noteId)", file: #file, function: #function, line: #line)
            let savedNote = try await notesRepository.updateNote(updatedNote)

            await MainActor.run {
                self.note = savedNote
                self.isLoading = false
                self.isEditing = false
            }
        } catch {
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = error.localizedDescription
                logger.error("Failed to update note: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func deleteNote() async {
        isLoading = true
        errorMessage = nil

        do {
            logger.info("Deleting note \(noteId)", file: #file, function: #function, line: #line)
            try await notesRepository.deleteNote(id: noteId)

            await MainActor.run {
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = error.localizedDescription
                logger.error("Failed to delete note: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func togglePin() async {
        guard var note = note else { return }

        var updatedNote = note
        updatedNote.isPinned.toggle()

        await updateNote(updatedNote)
    }

    func toggleArchive() async {
        guard var note = note else { return }

        var updatedNote = note
        updatedNote.isArchived.toggle()

        await updateNote(updatedNote)
    }

    func refresh() {
        Task {
            await loadNote()
        }
    }
}
