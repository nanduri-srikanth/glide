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
    @Published var password: String = ""
    @Published var name: String = ""
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
            logger.info("Attempting login for \(email)", file: #file, function: #function, line: #line)
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
            logger.info("Attempting registration for \(email)", file: #file, function: #function, line: #line)
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
        } catch {
            await MainActor.run {
                isLoading = false
                errorMessage = error.localizedDescription
                logger.error("Logout failed: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func clearError() {
        errorMessage = nil
    }
}
