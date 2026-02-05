//
//  FoldersRepository.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

/// Folders Repository for managing folder data
class FoldersRepository: FoldersRepositoryProtocol {

    // MARK: - Properties

    private let apiService: APIServiceProtocol
    private let authService: AuthServiceProtocol
    private var cachedFolders: [Folder] = []

    // MARK: - Initialization

    init(apiService: APIServiceProtocol, authService: AuthServiceProtocol) {
        self.apiService = apiService
        self.authService = authService
    }

    // MARK: - Methods

    func fetchFolders() async throws -> [FolderResponse] {
        let folders: [FolderResponse] = try await apiService.request(Endpoint.folders.path, method: .get, body: nil)
        // Note: We're not caching FolderResponse since we'd need a separate cache
        return folders
    }

    func createFolder(_ folder: Folder) async throws -> Folder {
        let body = try JSONEncoder().encode(folder)
        let createdFolder: Folder = try await apiService.request(Endpoint.folders.path, method: .post, body: body)
        cachedFolders.append(createdFolder)
        return createdFolder
    }

    func updateFolder(_ folder: Folder) async throws -> Folder {
        let body = try JSONEncoder().encode(folder)
        let updatedFolder: Folder = try await apiService.request(Endpoint.folder(id: folder.id).path, method: .patch, body: body)

        // Update cache
        if let index = cachedFolders.firstIndex(where: { $0.id == folder.id }) {
            cachedFolders[index] = updatedFolder
        }

        return updatedFolder
    }

    func deleteFolder(id: String) async throws {
        _ = try await apiService.request(Endpoint.folder(id: id).path, method: .delete, body: nil)

        // Remove from cache
        cachedFolders.removeAll { $0.id == id }
    }

    func reorderFolders(_ folders: [FolderReorderItem]) async throws {
        let requestBody = FolderBulkReorder(folders: folders)
        let body = try JSONEncoder().encode(requestBody)
        _ = try await apiService.request(Endpoint.foldersReorder.path, method: .post, body: body)

        // Refresh cache after reorder
        _ = try await fetchFolders()
    }
}
