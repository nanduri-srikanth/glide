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

        currentUserId = response.user.id

        logger.info("User logged in: \(response.user.id)", file: #file, function: #function, line: #line)
    }

    func register(email: String, password: String, name: String) async throws {
        let request = RegisterRequest(email: email, password: password, name: name)

        let body = try JSONEncoder().encode(request)
        let response: RegisterResponse = try await apiService.request("/auth/register", method: .post, body: body)

        // Save auth token and user ID
        try keychainService.set(key: "auth_token", value: response.token)
        try keychainService.set(key: "user_id", value: response.user.id)

        currentUserId = response.user.id

        logger.info("User registered: \(response.user.id)", file: #file, function: #function, line: #line)
    }

    func logout() async throws {
        // Call logout endpoint
        _ = try await apiService.request("/auth/logout", method: .post, body: nil) as EmptyResponse

        // Clear stored credentials
        try? keychainService.delete(key: "auth_token")
        try? keychainService.delete(key: "user_id")

        currentUserId = nil

        logger.info("User logged out", file: #file, function: #function, line: #line)
    }

    func refreshToken() async throws {
        // Implementation for token refresh
        fatalError("Token refresh not implemented yet")
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
        case .unknown(let message):
            return message
        }
    }
}
