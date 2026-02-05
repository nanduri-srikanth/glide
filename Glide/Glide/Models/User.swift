//
//  User.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

/// User model representing a user in the system
struct User: Codable, Identifiable, Equatable {

    // MARK: - Properties

    let id: String
    var email: String
    var name: String
    var avatarURL: String?
    var preferences: UserPreferences
    let createdAt: Date
    var updatedAt: Date

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case name
        case avatarURL = "avatar_url"
        case preferences
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    // MARK: - Computed Properties

    var initials: String {
        let components = name.components(separatedBy: .whitespacesAndNewlines)
        return components.compactMap { $0.first }.map { String($0) }.joined().uppercased()
    }

    var displayName: String {
        name.isEmpty ? email : name
    }

    // MARK: - Equatable

    static func == (lhs: User, rhs: User) -> Bool {
        lhs.id == rhs.id
    }
}

/// User preferences
struct UserPreferences: Codable, Equatable {
    var theme: AppTheme
    var notificationsEnabled: Bool
    var biometricAuthEnabled: Bool
    var autoSyncEnabled: Bool
    var preferredFontSize: FontSize

    init() {
        self.theme = .system
        self.notificationsEnabled = true
        self.biometricAuthEnabled = false
        self.autoSyncEnabled = true
        self.preferredFontSize = .medium
    }

    enum CodingKeys: String, CodingKey {
        case theme = "theme"
        case notificationsEnabled = "notifications_enabled"
        case biometricAuthEnabled = "biometric_auth_enabled"
        case autoSyncEnabled = "auto_sync_enabled"
        case preferredFontSize = "preferred_font_size"
    }
}

enum FontSize: String, Codable, CaseIterable {
    case small = "small"
    case medium = "medium"
    case large = "large"
    case extraLarge = "extra_large"

    var displayName: String {
        switch self {
        case .small: return "Small"
        case .medium: return "Medium"
        case .large: return "Large"
        case .extraLarge: return "Extra Large"
        }
    }

    var scale: CGFloat {
        switch self {
        case .small: return 0.85
        case .medium: return 1.0
        case .large: return 1.15
        case .extraLarge: return 1.3
        }
    }
}

// MARK: - Mock Data for Testing

#if DEBUG
extension User {
    static let mock = User(
        id: "1",
        email: "test@example.com",
        name: "Test User",
        avatarURL: nil,
        preferences: UserPreferences(),
        createdAt: Date(),
        updatedAt: Date()
    )
}
#endif
