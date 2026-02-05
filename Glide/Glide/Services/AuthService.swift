//
//  AuthService.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

/// Authentication Service
class AuthService: AuthServiceProtocol {

    // MARK: - Properties

    private(set) var isAuthenticated: Bool {
        return authToken != nil
    }

    private(set) var currentUserId: String?

    private let apiService: APIServiceProtocol
    private let keychainService: KeychainServiceProtocol
    private let logger: LoggerServiceProtocol

    private var authToken: String? {
        keychainService.get(key: "auth_token")
    }

    // MARK: - Types

    struct TokenResponse: Codable {
        let accessToken: String
        let refreshToken: String
        let tokenType: String
        let expiresIn: Int

        enum CodingKeys: String, CodingKey {
            case accessToken = "access_token"
            case refreshToken = "refresh_token"
            case tokenType = "token_type"
            case expiresIn = "expires_in"
        }
    }

    struct LoginRequest: Codable {
        let email: String
        let password: String
    }

    struct LoginResponse: Codable {
        let token: String
        let user: User
    }

    struct RegisterRequest: Codable {
        let email: String
        let password: String
        let name: String
    }

    struct RegisterResponse: Codable {
        let token: String
        let user: User
    }

    // MARK: - Initialization

    init(
        apiService: APIServiceProtocol,
        keychainService: KeychainServiceProtocol,
        logger: LoggerServiceProtocol
    ) {
        self.apiService = apiService
        self.keychainService = keychainService
        self.logger = logger

        // Load user ID from keychain if authenticated
        if isAuthenticated {
            self.currentUserId = keychainService.get(key: "user_id")
        }
    }

    // MARK: - Methods

    func login(email: String, password: String) async throws {
        let request = LoginRequest(email: email, password: password)

        let body = try JSONEncoder().encode(request)
        let response: LoginResponse = try await apiService.request("/auth/login", method: .post, body: body)

        // Save auth token and user ID
        try keychainService.set(key: "auth_token", value: response.token)
        try keychainService.set(key: "user_id", value: response.user.id)
        
        // Note: If backend provides refresh token, add it here
        // try keychainService.set(key: "refresh_token", value: response.refreshToken)
        
        currentUserId = response.user.id

        logger.info("User logged in successfully", file: #file, function: #function, line: #line)
    }

    func register(email: String, password: String, name: String) async throws {
        let request = RegisterRequest(email: email, password: password, name: name)

        let body = try JSONEncoder().encode(request)
        let response: RegisterResponse = try await apiService.request("/auth/register", method: .post, body: body)

        // Save auth token and user ID
        try keychainService.set(key: "auth_token", value: response.token)
        try keychainService.set(key: "user_id", value: response.user.id)
        
        // Note: If backend provides refresh token, add it here
        // try keychainService.set(key: "refresh_token", value: response.refreshToken)
        
        currentUserId = response.user.id

        logger.info("User registered successfully", file: #file, function: #function, line: #line)
    }

    func logout() async throws {
        // Call logout endpoint
        _ = try await apiService.request("/auth/logout", method: .post, body: nil) as EmptyResponse

        // Clear stored credentials with proper error handling
        var deletionErrors: [String] = []

        // Delete auth token
        do {
            try keychainService.delete(key: "auth_token")
        } catch {
            deletionErrors.append("auth_token: \(error.localizedDescription)")
            logger.warning("Failed to delete auth_token from keychain: \(error.localizedDescription)", file: #file, function: #function, line: #line)
        }

        // Delete refresh token
        do {
            try keychainService.delete(key: "refresh_token")
        } catch {
            deletionErrors.append("refresh_token: \(error.localizedDescription)")
            logger.warning("Failed to delete refresh_token from keychain: \(error.localizedDescription)", file: #file, function: #function, line: #line)
        }

        // Delete user ID
        do {
            try keychainService.delete(key: "user_id")
        } catch {
            deletionErrors.append("user_id: \(error.localizedDescription)")
            logger.warning("Failed to delete user_id from keychain: \(error.localizedDescription)", file: #file, function: #function, line: #line)
        }

        // Always clear local state to ensure app appears logged out
        currentUserId = nil

        // Check if there were any deletion errors
        if !deletionErrors.isEmpty {
            logger.warning("Failed to clear some credentials during logout: \(deletionErrors)", file: #file, function: #function, line: #line)

            // Determine if this is a critical failure (all items failed to delete)
            let isCriticalFailure = deletionErrors.count == 3

            if isCriticalFailure {
                // All deletion attempts failed - this is a complete failure
                throw AuthError.logoutFailed("All credentials remain in keychain. Please restart the app.")
            } else {
                // Partial failure - some items were deleted
                throw AuthError.partialLogout(deletionErrors)
            }
        }

        logger.info("User logged out successfully", file: #file, function: #function, line: #line)
    }

    func refreshToken() async throws {
        guard let refreshToken = keychainService.get(key: "refresh_token") else {
            throw AuthError.invalidCredentials
        }

        let body = try JSONEncoder().encode(["refresh_token": refreshToken])
        let response: TokenResponse = try await apiService.request("/auth/refresh", method: .post, body: body)

        // Save new tokens
        try keychainService.set(key: "auth_token", value: response.accessToken)
        try keychainService.set(key: "refresh_token", value: response.refreshToken)

        logger.info("Token refreshed successfully", file: #file, function: #function, line: #line)
    }

    // MARK: - Helper Types

    struct EmptyResponse: Codable {}
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case invalidCredentials
    case userNotFound
    case emailAlreadyExists
    case weakPassword
    case tooManyAttempts
    case logoutFailed(String)
    case partialLogout([String])
    case unknown(String)

    var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return "Invalid email or password"
        case .userNotFound:
            return "User not found"
        case .emailAlreadyExists:
            return "An account with this email already exists"
        case .weakPassword:
            return "Password is too weak"
        case .tooManyAttempts:
            return "Too many login attempts. Please try again later."
        case .logoutFailed(let message):
            return "Logout failed: \(message)"
        case .partialLogout(let failedItems):
            return "Logged out but some data may remain. Please restart the app. Failed items: \(failedItems.joined(separator: ", "))"
        case .unknown(let message):
            return message
        }
    }
}
