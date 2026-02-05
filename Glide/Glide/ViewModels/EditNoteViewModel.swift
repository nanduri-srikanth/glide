//
//  EditNoteViewModel.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation
import SwiftUI
import Combine

/// View Model for editing an existing note
@MainActor
class EditNoteViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published var title: String
    @Published var content: String
    @Published var selectedFolderId: UUID?
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var isPresented: Bool = true

    // MARK: - Properties

    private let originalNote: Note
    private let notesRepository: NotesRepositoryProtocol
    private let logger: LoggerServiceProtocol

    // MARK: - Initialization

    init(
        note: Note,
        notesRepository: NotesRepositoryProtocol,
        logger: LoggerServiceProtocol
    ) {
        self.originalNote = note
        self.notesRepository = notesRepository
        self.logger = logger

        // Initialize with existing note data
        self.title = note.title
        self.content = note.content
        self.selectedFolderId = UUID(uuidString: note.folderId ?? "")
    }

    // MARK: - Computed Properties

    var hasChanges: Bool {
        title != originalNote.title ||
        content != originalNote.content ||
        selectedFolderId?.uuidString != originalNote.folderId
    }

    var canSave: Bool {
        hasChanges && !isLoading
    }

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: - Actions

    func saveChanges() async {
        guard canSave else { return }
        guard isValid else {
            errorMessage = "Note must have either a title or content"
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            logger.info("Saving changes to note \(originalNote.id)", file: #file, function: #function, line: #line)

            // Create updated note with changed fields
            var updatedNote = originalNote
            updatedNote.title = title.isEmpty ? "Untitled" : title
            updatedNote.content = content

            // Update folder ID if changed
            if let folderId = selectedFolderId {
                updatedNote.folderId = folderId.uuidString
            } else {
                updatedNote.folderId = nil
            }

            // Update timestamp
            updatedNote.updatedAt = Date()

            // Save via repository
            let savedNote = try await notesRepository.updateNote(updatedNote)

            await MainActor.run {
                self.isLoading = false
                self.dismiss()
                logger.info("Note \(originalNote.id) updated successfully", file: #file, function: #function, line: #line)
            }

        } catch {
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = error.localizedDescription
                logger.error("Failed to update note: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func cancel() {
        dismiss()
    }

    func dismiss() {
        isPresented = false
    }
}
