//
//  AppState.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation
import SwiftUI

/// Global application state management
/// Provides a centralized way to manage app-wide state and notifications
@MainActor
class AppState: ObservableObject {

    // MARK: - Singleton

    static let shared = AppState()

    // MARK: - Published Properties

    /// Current authentication state
    @Published var isAuthenticated: Bool = false

    /// Current user ID (if authenticated)
    @Published var currentUserId: String?

    /// Network connectivity status
    @Published var isNetworkAvailable: Bool = true

    /// Current app theme
    @Published var currentTheme: AppTheme = .system

    /// Loading state for global operations
    @Published var isLoading: Bool = false

    /// Global error message for displaying to user
    @Published var errorMessage: String?

    /// Global success message for displaying to user
    @Published var successMessage: String?

    // MARK: - Initialization

    private init() {
        // Initialize state from persisted values if needed
        loadPersistedState()
    }

    // MARK: - State Management

    /// Update authentication state
    func setAuthenticated(_ authenticated: Bool, userId: String? = nil) {
        isAuthenticated = authenticated
        currentUserId = userId
    }

    /// Update network connectivity status
    func setNetworkAvailability(_ available: Bool) {
        isNetworkAvailable = available
    }

    /// Show an error message to the user
    func showError(_ message: String) {
        errorMessage = message
    }

    /// Show a success message to the user
    func showSuccess(_ message: String) {
        successMessage = message
    }

    /// Clear all messages
    func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }

    /// Set the app theme
    func setTheme(_ theme: AppTheme) {
        currentTheme = theme
        // Persist theme preference
        UserDefaults.standard.set(theme.rawValue, forKey: "appTheme")
    }

    // MARK: - Persistence

    private func loadPersistedState() {
        // Load theme preference
        if let themeRaw = UserDefaults.standard.string(forKey: "appTheme"),
           let theme = AppTheme(rawValue: themeRaw) {
            currentTheme = theme
        }

        // Load other persisted state as needed
    }
}

// MARK: - App Theme

enum AppTheme: String, CaseIterable {
    case light
    case dark
    case system

    var displayName: String {
        switch self {
        case .light: return "Light"
        case .dark: return "Dark"
        case .system: return "System"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .light: return .light
        case .dark: return .dark
        case .system: return nil
        }
    }
}
