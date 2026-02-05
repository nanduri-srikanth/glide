//
//  UserRepository.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

/// User Repository for managing user data
class UserRepository: UserRepositoryProtocol {

    // MARK: - Properties

    private let apiService: APIServiceProtocol
    private let authService: AuthServiceProtocol
    private var cachedUser: User?

    // MARK: - Initialization

    init(apiService: APIServiceProtocol, authService: AuthServiceProtocol) {
        self.apiService = apiService
        self.authService = authService
    }

    // MARK: - Methods

    func getCurrentUser() async throws -> User {
        // Return cached user if available
        if let cached = cachedUser {
            return cached
        }

        // Fetch from API
        let user: User = try await apiService.request("/users/me", method: .get, body: nil)
        cachedUser = user
        return user
    }

    func updateProfile(_ user: User) async throws -> User {
        let body = try JSONEncoder().encode(user)
        let updatedUser: User = try await apiService.request("/users/me", method: .put, body: body)
        cachedUser = updatedUser
        return updatedUser
    }
}
