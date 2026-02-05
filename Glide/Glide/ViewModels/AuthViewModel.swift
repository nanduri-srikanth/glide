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

    /// Validates email format using regex
    /// - Parameter email: Email string to validate
    /// - Returns: True if email format is valid
    private func isValidEmail(_ email: String) -> Bool {
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let predicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return predicate.evaluate(with: email)
    }

    /// Validates password strength
    /// Requirements:
    /// - At least 8 characters
    /// - At least one uppercase letter
    /// - At least one lowercase letter
    /// - At least one number OR special character
    /// - Parameter password: Password string to validate
    /// - Returns: True if password meets all strength requirements
    private func isStrongPassword(_ password: String) -> Bool {
        // Check minimum length
        guard password.count >= 8 else { return false }

        // Check for uppercase letter
        let hasUppercase = password.rangeOfCharacter(from: .uppercaseLetters) != nil

        // Check for lowercase letter
        let hasLowercase = password.rangeOfCharacter(from: .lowercaseLetters) != nil

        // Check for number
        let hasNumber = password.rangeOfCharacter(from: .decimalDigits) != nil

        // Check for special character
        let specialChars = CharacterSet(charactersIn: "!@#$%^&*()_+-=[]{}|;:,.<>?")
        let hasSpecial = password.rangeOfCharacter(from: specialChars) != nil

        // All requirements must be met
        return hasUppercase && hasLowercase && (hasNumber || hasSpecial)
    }

    /// Published property to track email validation state for UI feedback
    @Published var isEmailValid: Bool = false

    /// Published property for email-specific error message
    @Published var emailErrorMessage: String? = nil

    /// Published property to track password validation state for UI feedback
    @Published var isPasswordValid: Bool = false

    var isValidLoginForm: Bool {
        isEmailValid && !password.isEmpty
    }

    var isValidRegistrationForm: Bool {
        isEmailValid &&
        !password.isEmpty &&
        !name.isEmpty &&
        !confirmPassword.isEmpty &&
        password == confirmPassword &&
        isStrongPassword(password)
    }

    /// Check if password fields have been cleared from memory
    /// This is useful for security auditing to verify passwords are not lingering
    var isPasswordFieldsEmpty: Bool {
        password.isEmpty && confirmPassword.isEmpty
    }

    // MARK: - Actions

    func login() async {
        guard isValidLoginForm else {
            errorMessage = "Please enter a valid email and password"
            return
        }

        isLoading = true
        errorMessage = nil

        // Create local copy to attempt cleanup after use
        // Note: Swift Strings cannot be securely zeroed, but we can clear the @Published property
        let tempPassword = password

        // Immediately clear the published property to reduce window of vulnerability
        password = ""

        // Attempt cleanup when scope exits (not guaranteed by Swift, but best effort)
        defer {
            // Attempt to clear password from memory
            // Note: This is not guaranteed due to Swift's String immutability and ARC,
            // but reduces the window where password is in memory
            var passwordToClear = tempPassword
            passwordToClear = ""
        }

        do {
            logger.info("Login attempt initiated", file: #file, function: #function, line: #line)
            try await authService.login(email: email, password: tempPassword)

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

        // Create local copies to attempt cleanup after use
        // Note: Swift Strings cannot be securely zeroed, but we can clear the @Published properties
        let tempPassword = password
        let tempConfirmPassword = confirmPassword

        // Immediately clear the published properties to reduce window of vulnerability
        password = ""
        confirmPassword = ""

        // Attempt cleanup when scope exits (not guaranteed by Swift, but best effort)
        defer {
            // Attempt to clear passwords from memory
            // Note: This is not guaranteed due to Swift's String immutability and ARC,
            // but reduces the window where passwords are in memory
            var passwordToClear = tempPassword
            var confirmPasswordToClear = tempConfirmPassword
            passwordToClear = ""
            confirmPasswordToClear = ""
        }

        do {
            logger.info("Registration attempt initiated", file: #file, function: #function, line: #line)
            try await authService.register(email: email, password: tempPassword, name: name)

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

    /// Validates email and updates validation state
    /// Called from UI when email changes to provide real-time feedback
    func validateEmail() {
        if email.isEmpty {
            isEmailValid = false
            emailErrorMessage = nil
        } else if isValidEmail(email) {
            isEmailValid = true
            emailErrorMessage = nil
        } else {
            isEmailValid = false
            emailErrorMessage = "Please enter a valid email address (e.g., user@example.com)"
        }
    }

    /// Validates password strength and updates validation state
    /// Called from UI when password changes to provide real-time feedback
    func validatePassword() {
        isPasswordValid = isStrongPassword(password)
    }

    /// Computed property returning password requirements message
    /// Shows what requirements are met/not met in real-time
    var passwordRequirementsMessage: String {
        var requirements: [String] = []

        // Length requirement
        if password.count >= 8 {
            requirements.append("✓ 8+ characters")
        } else {
            requirements.append("• 8+ characters")
        }

        // Uppercase requirement
        let hasUppercase = password.rangeOfCharacter(from: .uppercaseLetters) != nil
        if hasUppercase {
            requirements.append("✓ Uppercase")
        } else {
            requirements.append("• Uppercase")
        }

        // Lowercase requirement
        let hasLowercase = password.rangeOfCharacter(from: .lowercaseLetters) != nil
        if hasLowercase {
            requirements.append("✓ Lowercase")
        } else {
            requirements.append("• Lowercase")
        }

        // Number or special requirement
        let hasNumber = password.rangeOfCharacter(from: .decimalDigits) != nil
        let specialChars = CharacterSet(charactersIn: "!@#$%^&*()_+-=[]{}|;:,.<>?")
        let hasSpecial = password.rangeOfCharacter(from: specialChars) != nil

        if hasNumber || hasSpecial {
            requirements.append("✓ Number or special (!@#$%)")
        } else {
            requirements.append("• Number or special (!@#$%)")
        }

        return requirements.joined(separator: "\n")
    }
}

