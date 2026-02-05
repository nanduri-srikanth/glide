//
//  NotesRepository.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

/// Notes Repository for managing note data
class NotesRepository: NotesRepositoryProtocol {

    // MARK: - Properties

    private let apiService: APIServiceProtocol
    private let authService: AuthServiceProtocol
    private var cachedNotes: [Note] = []

    // MARK: - Initialization

    init(apiService: APIServiceProtocol, authService: AuthServiceProtocol) {
        self.apiService = apiService
        self.authService = authService
    }

    // MARK: - Methods

    func fetchNotes() async throws -> [Note] {
        let notes: [Note] = try await apiService.request("/notes", method: .get, body: nil)
        cachedNotes = notes
        return notes
    }

    func fetchNote(id: String) async throws -> Note {
        // Check cache first
        if let cached = cachedNotes.first(where: { $0.id == id }) {
            return cached
        }

        // Fetch from API
        let note: Note = try await apiService.request("/notes/\(id)", method: .get, body: nil)

        // Update cache
        if let index = cachedNotes.firstIndex(where: { $0.id == id }) {
            cachedNotes[index] = note
        } else {
            cachedNotes.append(note)
        }

        return note
    }

    func createNote(_ note: Note) async throws -> Note {
        let body = try JSONEncoder().encode(note)
        let createdNote: Note = try await apiService.request("/notes", method: .post, body: body)
        cachedNotes.append(createdNote)
        return createdNote
    }

    func updateNote(_ note: Note) async throws -> Note {
        let body = try JSONEncoder().encode(note)
        let updatedNote: Note = try await apiService.request("/notes/\(note.id)", method: .put, body: body)

        // Update cache
        if let index = cachedNotes.firstIndex(where: { $0.id == note.id }) {
            cachedNotes[index] = updatedNote
        }

        return updatedNote
    }

    func deleteNote(id: String) async throws {
        _ = try await apiService.request("/notes/\(id)", method: .delete, body: nil)

        // Remove from cache
        cachedNotes.removeAll { $0.id == id }
    }
}
