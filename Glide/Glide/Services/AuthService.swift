//
//  AuthService.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation
import BackgroundTasks

/// Authentication Service
class AuthService: AuthServiceProtocol {

    // MARK: - Properties

    private(set) var isAuthenticated: Bool {
        return authToken != nil && isTokenValid
    }

    private(set) var currentUserId: String?

    private let apiService: APIServiceProtocol
    private let keychainService: KeychainServiceProtocol
    private let logger: LoggerServiceProtocol

    private var authToken: String? {
        keychainService.get(key: "auth_token")
    }

    /// Token expiration date loaded from keychain
    private var tokenExpirationDate: Date? {
        didSet {
            // Schedule background refresh task when expiration is set
            if let expiration = tokenExpirationDate {
                scheduleBackgroundTokenRefresh(expiration: expiration)
            }
        }
    }

    /// Check if the current token is still valid (not expired)
    private var isTokenValid: Bool {
        guard let expiration = tokenExpirationDate else {
            // If no expiration is set, assume token is valid
            // (for backward compatibility with tokens stored before this feature)
            return true
        }
        return Date() < expiration
    }

    /// Time buffer before expiration to trigger proactive refresh (5 minutes)
    private let tokenRefreshBuffer: TimeInterval = 5 * 60 // 5 minutes

    // Background task identifier for token refresh
    private let backgroundTaskIdentifier = "com.glide.tokenRefresh"

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

        // Optional: If backend provides expiration info
        let expiresIn: Int?
        let refresh_token: String?
    }

    struct RegisterRequest: Codable {
        let email: String
        let password: String
        let name: String
    }

    struct RegisterResponse: Codable {
        let token: String
        let user: User

        // Optional: If backend provides expiration info
        let expiresIn: Int?
        let refresh_token: String?
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

        // Load user ID and token expiration from keychain if authenticated
        if authToken != nil {
            self.currentUserId = keychainService.get(key: "user_id")

            // Load token expiration date
            if let expirationString = keychainService.get(key: "token_expiration"),
               let expirationTimestamp = TimeInterval(expirationString) {
                self.tokenExpirationDate = Date(timeIntervalSince1970: expirationTimestamp)

                logger.debug("Loaded token expiration: \(tokenExpirationDate?.description ?? "none")",
                           file: #file, function: #function, line: #line)
            }

            // Check if token needs immediate refresh
            Task {
                try? await refreshTokenIfNeeded()
            }
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

        // Store refresh token if provided
        if let refreshToken = response.refresh_token {
            try keychainService.set(key: "refresh_token", value: refreshToken)
        }

        // Calculate and store token expiration
        if let expiresIn = response.expiresIn {
            let expiration = Date().addingTimeInterval(TimeInterval(expiresIn))
            self.tokenExpirationDate = expiration

            // Store in keychain for persistence across app launches
            try keychainService.set(key: "token_expiration", value: String(expiration.timeIntervalSince1970))

            logger.info("Token expires at: \(expiration)", file: #file, function: #function, line: #line)
        } else {
            // Default expiration if not provided (24 hours)
            let defaultExpiration: TimeInterval = 24 * 60 * 60
            let expiration = Date().addingTimeInterval(defaultExpiration)
            self.tokenExpirationDate = expiration
            try keychainService.set(key: "token_expiration", value: String(expiration.timeIntervalSince1970))

            logger.info("Using default token expiration (24 hours)", file: #file, function: #function, line: #line)
        }

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

        // Store refresh token if provided
        if let refreshToken = response.refresh_token {
            try keychainService.set(key: "refresh_token", value: refreshToken)
        }

        // Calculate and store token expiration
        if let expiresIn = response.expiresIn {
            let expiration = Date().addingTimeInterval(TimeInterval(expiresIn))
            self.tokenExpirationDate = expiration

            // Store in keychain for persistence across app launches
            try keychainService.set(key: "token_expiration", value: String(expiration.timeIntervalSince1970))

            logger.info("Token expires at: \(expiration)", file: #file, function: #function, line: #line)
        } else {
            // Default expiration if not provided (24 hours)
            let defaultExpiration: TimeInterval = 24 * 60 * 60
            let expiration = Date().addingTimeInterval(defaultExpiration)
            self.tokenExpirationDate = expiration
            try keychainService.set(key: "token_expiration", value: String(expiration.timeIntervalSince1970))

            logger.info("Using default token expiration (24 hours)", file: #file, function: #function, line: #line)
        }

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

        // Delete token expiration
        do {
            try keychainService.delete(key: "token_expiration")
        } catch {
            deletionErrors.append("token_expiration: \(error.localizedDescription)")
            logger.warning("Failed to delete token_expiration from keychain: \(error.localizedDescription)", file: #file, function: #function, line: #line)
        }

        // Clear local state
        currentUserId = nil
        tokenExpirationDate = nil

        // Cancel background tasks
        BGTaskScheduler.shared.cancel(taskIdentifier: backgroundTaskIdentifier)

        // Check if there were any deletion errors
        if !deletionErrors.isEmpty {
            logger.warning("Failed to clear some credentials during logout: \(deletionErrors)", file: #file, function: #function, line: #line)

            // Determine if this is a critical failure (all items failed to delete)
            let isCriticalFailure = deletionErrors.count == 4

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

        // Update token expiration
        let expiration = Date().addingTimeInterval(TimeInterval(response.expiresIn))
        self.tokenExpirationDate = expiration
        try keychainService.set(key: "token_expiration", value: String(expiration.timeIntervalSince1970))

        logger.info("Token refreshed successfully, new expiration: \(expiration)", file: #file, function: #function, line: #line)
    }

    // MARK: - Token Expiration Management

    /// Proactively refresh token if it's about to expire (within 5 minutes)
    /// This should be called before making API requests to prevent 401 errors
    func refreshTokenIfNeeded() async throws {
        guard let expiration = tokenExpirationDate else {
            // No expiration set, skip refresh
            return
        }

        let timeUntilExpiration = expiration.timeIntervalSince(Date)

        // Refresh if token expires within the buffer period (5 minutes) or is already expired
        if timeUntilExpiration <= tokenRefreshBuffer {
            logger.info("Token expiring in \(Int(timeUntilExpiration))s, refreshing proactively",
                       file: #file, function: #function, line: #line)

            try await refreshToken()
        } else {
            logger.debug("Token valid for \(Int(timeUntilExpiration))s, no refresh needed",
                       file: #file, function: #function, line: #line)
        }
    }

    /// Get remaining time until token expires (in seconds)
    /// Returns nil if expiration is not set
    func timeUntilTokenExpiration() -> TimeInterval? {
        guard let expiration = tokenExpirationDate else {
            return nil
        }
        return expiration.timeIntervalSince(Date)
    }

    /// Check if token is expired or will expire soon
    func isTokenExpiringSoon() -> Bool {
        guard let timeRemaining = timeUntilTokenExpiration() else {
            return false
        }
        return timeRemaining <= tokenRefreshBuffer
    }

    // MARK: - Background Tasks

    /// Schedule background task to refresh token before it expires
    private func scheduleBackgroundTokenRefresh(expiration: Date) {
        // Schedule refresh for 5 minutes before expiration
        let refreshTime = expiration.addingTimeInterval(-tokenRefreshBuffer)

        // Only schedule if the refresh time is in the future
        guard refreshTime > Date() else {
            logger.debug("Token expiring too soon to schedule background refresh",
                       file: #file, function: #function, line: #line)
            return
        }

        let request = BGAppRefreshTaskRequest(identifier: backgroundTaskIdentifier)
        request.earliestBeginDate = refreshTime

        do {
            try BGTaskScheduler.shared.submit(request)
            logger.info("Scheduled background token refresh at: \(refreshTime)",
                       file: #file, function: #function, line: #line)
        } catch {
            logger.warning("Failed to schedule background token refresh: \(error.localizedDescription)",
                          file: #file, function: #function, line: #line)
        }
    }

    /// Handle background task execution
    func handleBackgroundTokenRefresh(task: BGAppRefreshTask) {
        // Schedule the next refresh before processing this one
        scheduleNextBackgroundRefresh()

        task.expirationHandler = {
            // Cancel if task expires before completing
            task.setTaskCompleted(success: false)
            self.logger.warning("Background token refresh task expired",
                              file: #file, function: #function, line: #line)
        }

        Task {
            do {
                try await refreshTokenIfNeeded()
                task.setTaskCompleted(success: true)
                logger.info("Background token refresh completed successfully",
                          file: #file, function: #function, line: #line)
            } catch {
                task.setTaskCompleted(success: false)
                logger.error("Background token refresh failed: \(error.localizedDescription)",
                           file: #file, function: #function, line: #line)
            }
        }
    }

    /// Schedule the next background refresh after current one completes
    private func scheduleNextBackgroundRefresh() {
        guard let expiration = tokenExpirationDate else {
            return
        }
        scheduleBackgroundTokenRefresh(expiration: expiration)
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
