//
//  SettingsViewModel.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation
import SwiftUI
import Combine

/// View Model for the settings screen
@MainActor
class SettingsViewModel: ObservableObject {

    // MARK: - Published Properties

    @Published var currentTheme: AppTheme
    @Published var notificationsEnabled: Bool
    @Published var biometricAuthEnabled: Bool
    @Published var autoSyncEnabled: Bool
    @Published var preferredFontSize: FontSize
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var successMessage: String?

    // MARK: - Dependencies

    private let userDefaultsService: UserDefaultsServiceProtocol
    private let authService: AuthServiceProtocol
    private let logger: LoggerServiceProtocol

    // MARK: - Initialization

    init(
        userDefaultsService: UserDefaultsServiceProtocol,
        authService: AuthServiceProtocol,
        logger: LoggerServiceProtocol
    ) {
        self.userDefaultsService = userDefaultsService
        self.authService = authService
        self.logger = logger

        // Load settings
        self.currentTheme = AppState.shared.currentTheme
        self.notificationsEnabled = userDefaultsService.get("notifications_enabled", defaultValue: true)
        self.biometricAuthEnabled = userDefaultsService.get("biometric_auth_enabled", defaultValue: false)
        self.autoSyncEnabled = userDefaultsService.get("auto_sync_enabled", defaultValue: true)

        let fontSizeRaw: String = userDefaultsService.get("preferred_font_size", defaultValue: "medium")
        self.preferredFontSize = FontSize(rawValue: fontSizeRaw) ?? .medium
    }

    // MARK: - Actions

    func updateTheme(_ theme: AppTheme) {
        currentTheme = theme
        AppState.shared.setTheme(theme)
        userDefaultsService.set("appTheme", value: theme.rawValue)
        logger.info("Theme updated to \(theme.rawValue)", file: #file, function: #function, line: #line)
    }

    func toggleNotifications(_ enabled: Bool) {
        notificationsEnabled = enabled
        userDefaultsService.set("notifications_enabled", value: enabled)
        logger.info("Notifications \(enabled ? "enabled" : "disabled")", file: #file, function: #function, line: #line)
    }

    func toggleBiometricAuth(_ enabled: Bool) {
        biometricAuthEnabled = enabled
        userDefaultsService.set("biometric_auth_enabled", value: enabled)
        logger.info("Biometric auth \(enabled ? "enabled" : "disabled")", file: #file, function: #function, line: #line)
    }

    func toggleAutoSync(_ enabled: Bool) {
        autoSyncEnabled = enabled
        userDefaultsService.set("auto_sync_enabled", value: enabled)
        logger.info("Auto sync \(enabled ? "enabled" : "disabled")", file: #file, function: #function, line: #line)
    }

    func updateFontSize(_ size: FontSize) {
        preferredFontSize = size
        userDefaultsService.set("preferred_font_size", value: size.rawValue)
        logger.info("Font size updated to \(size.rawValue)", file: #file, function: #function, line: #line)
    }

    func clearCache() async {
        isLoading = true

        // Simulate cache clearing
        try? await Task.sleep(nanoseconds: 1_000_000_000)

        await MainActor.run {
            isLoading = false
            successMessage = "Cache cleared successfully"
            logger.info("Cache cleared", file: #file, function: #function, line: #line)
        }
    }

    func logout() async {
        isLoading = true

        do {
            try await authService.logout()

            await MainActor.run {
                AppState.shared.setAuthenticated(false, userId: nil)
                isLoading = false
            }

            logger.info("Logged out successfully", file: #file, function: #function, line: #line)
        } catch {
            await MainActor.run {
                isLoading = false
                errorMessage = error.localizedDescription
                logger.error("Logout failed: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            }
        }
    }

    func clearMessages() {
        errorMessage = nil
        successMessage = nil
    }
}
