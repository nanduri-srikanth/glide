//
//  CreateNoteViewModel.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation
import SwiftUI

/// View Model for creating a new note
@MainActor
class CreateNoteViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published var title: String = ""
    @Published var transcript: String = ""
    @Published var selectedFolderId: UUID? = nil
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var createdNote: Note?
    @Published var isPresented: Bool = true

    // MARK: - Dependencies

    private let notesRepository: NotesRepositoryProtocol
    private let foldersRepository: FoldersRepositoryProtocol
    private let logger: LoggerServiceProtocol

    // MARK: - Initialization

    init(
        notesRepository: NotesRepositoryProtocol,
        foldersRepository: FoldersRepositoryProtocol,
        logger: LoggerServiceProtocol
    ) {
        self.notesRepository = notesRepository
        self.foldersRepository = foldersRepository
        self.logger = logger
    }

    // MARK: - Computed Properties

    var isValid: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var canSave: Bool {
        isValid && !isLoading
    }

    // MARK: - Actions

    func createNote() async {
        guard canSave else { return }

        isLoading = true
        errorMessage = nil

        do {
            logger.info("Creating new note", file: #file, function: #function, line: #line)

            // Create the note with current values
            var newNote = Note(
                title: title.isEmpty ? "Untitled" : title,
                content: transcript
            )

            // Set folder ID if selected
            if let folderId = selectedFolderId {
                newNote.folderId = folderId.uuidString
            }

            // Create the note via repository
            let created = try await notesRepository.createNote(newNote)

            await MainActor.run {
                self.createdNote = created
                self.isLoading = false
                self.dismiss()
                logger.info("Note created successfully with ID: \(created.id)", file: #file, function: #function, line: #line)
            }

        } catch {
            await MainActor.run {
                self.isLoading = false
                self.errorMessage = error.localizedDescription
                logger.error("Failed to create note: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func cancel() {
        dismiss()
    }

    func dismiss() {
        isPresented = false
    }

    // MARK: - Reset

    func reset() {
        title = ""
        transcript = ""
        selectedFolderId = nil
        isLoading = false
        errorMessage = nil
        createdNote = nil
        isPresented = true
    }
}
