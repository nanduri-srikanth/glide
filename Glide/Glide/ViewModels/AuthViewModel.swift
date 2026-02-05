//
//  AuthViewModel.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation
import SwiftUI

/// View Model for authentication screens
@MainActor
class AuthViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published var email: String = ""

    // TODO: Consider using Data type for more secure password handling
    // Swift Strings cannot be securely zeroed from memory, making them
    // vulnerable to memory dumps and debugging attacks. For enhanced security,
    // refactor to use Data or NSMutableData which allows explicit memory clearing.
    @Published var password: String = ""

    @Published var name: String = ""

    // TODO: Consider using Data type for more secure password handling
    // Swift Strings cannot be securely zeroed from memory, making them
    // vulnerable to memory dumps and debugging attacks. For enhanced security,
    // refactor to use Data or NSMutableData which allows explicit memory clearing.
    @Published var confirmPassword: String = ""

    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var isAuthenticated: Bool = false

    // MARK: - Dependencies

    private let authService: AuthServiceProtocol
    private let userDefaultsService: UserDefaultsServiceProtocol
    private let logger: LoggerServiceProtocol

    // MARK: - Initialization

    init(
        authService: AuthServiceProtocol,
        userDefaultsService: UserDefaultsServiceProtocol,
        logger: LoggerServiceProtocol
    ) {
        self.authService = authService
        self.userDefaultsService = userDefaultsService
        self.logger = logger
    }

    // MARK: - Validation

    var isValidLoginForm: Bool {
        !email.isEmpty && !password.isEmpty && email.contains("@")
    }

    var isValidRegistrationForm: Bool {
        !email.isEmpty &&
        !password.isEmpty &&
        !name.isEmpty &&
        !confirmPassword.isEmpty &&
        email.contains("@") &&
        password == confirmPassword &&
        password.count >= 8
    }

    // MARK: - Actions

    func login() async {
        guard isValidLoginForm else {
            errorMessage = "Please enter a valid email and password"
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            logger.info("Login attempt initiated", file: #file, function: #function, line: #line)
            try await authService.login(email: email, password: password)

            // Update app state
            await MainActor.run {
                AppState.shared.setAuthenticated(true, userId: authService.currentUserId)
                isAuthenticated = true
                isLoading = false
            }

            logger.info("Login successful", file: #file, function: #function, line: #line)
        } catch {
            await MainActor.run {
                isLoading = false
                errorMessage = error.localizedDescription
                logger.error("Login failed: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func register() async {
        guard isValidRegistrationForm else {
            errorMessage = "Please fill in all fields correctly. Password must be at least 8 characters."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            logger.info("Registration attempt initiated", file: #file, function: #function, line: #line)
            try await authService.register(email: email, password: password, name: name)

            // Update app state
            await MainActor.run {
                AppState.shared.setAuthenticated(true, userId: authService.currentUserId)
                isAuthenticated = true
                isLoading = false
            }

            logger.info("Registration successful", file: #file, function: #function, line: #line)
        } catch {
            await MainActor.run {
                isLoading = false
                errorMessage = error.localizedDescription
                logger.error("Registration failed: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func logout() async {
        isLoading = true

        do {
            try await authService.logout()

            await MainActor.run {
                AppState.shared.setAuthenticated(false, userId: nil)
                isAuthenticated = false
                isLoading = false
            }

            logger.info("Logout successful", file: #file, function: #function, line: #line)
        } catch let authError as AuthError {
            await MainActor.run {
                isLoading = false

                switch authError {
                case .partialLogout:
                    // For partial logout, still clear authentication state but warn user
                    AppState.shared.setAuthenticated(false, userId: nil)
                    isAuthenticated = false
                    errorMessage = authError.localizedDescription
                    logger.warning("Partial logout completed: \(authError.localizedDescription)", file: #file, function: #function, line: #line)

                case .logoutFailed:
                    // For complete logout failure, don't clear authentication state
                    errorMessage = authError.localizedDescription
                    logger.error("Logout failed: \(authError.localizedDescription)", file: #file, function: #function, line: #line)

                default:
                    // Other auth errors
                    errorMessage = authError.localizedDescription
                    logger.error("Logout error: \(authError.localizedDescription)", file: #file, function: #function, line: #line)
                }
            }
        } catch {
            await MainActor.run {
                isLoading = false
                errorMessage = error.localizedDescription
                logger.error("Logout failed with unexpected error: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func clearError() {
        errorMessage = nil
    }
}
