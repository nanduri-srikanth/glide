//
//  UserModels.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Aligned with backend: app/schemas/user_schemas.py
//

import Foundation

// MARK: - User Response

struct UserResponse: Codable, Equatable {
    let id: UUID
    let email: String
    let fullName: String?
    let isActive: Bool
    let isVerified: Bool
    let timezone: String
    let autoTranscribe: Bool
    let autoCreateActions: Bool
    let createdAt: Date

    // Integration status
    let googleConnected: Bool
    let appleConnected: Bool

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case fullName = "full_name"
        case isActive = "is_active"
        case isVerified = "is_verified"
        case timezone
        case autoTranscribe = "auto_transcribe"
        case autoCreateActions = "auto_create_actions"
        case createdAt = "created_at"
        case googleConnected = "google_connected"
        case appleConnected = "apple_connected"
    }

    // MARK: - Computed Properties

    var displayName: String {
        fullName?.isEmpty == false ? fullName! : email
    }

    var initials: String {
        let components = displayName.components(separatedBy: .whitespaces)
        return components.compactMap { $0.first }.map { String($0) }.joined().uppercased()
    }

    // MARK: - Equatable

    static func == (lhs: UserResponse, rhs: UserResponse) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - Token

struct Token: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
    let tokenType: String
    let expiresIn: Int

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case tokenType = "token_type"
        case expiresIn = "expires_in"
    }

    // MARK: - Computed Properties

    var expirationDate: Date {
        return Date().addingTimeInterval(TimeInterval(expiresIn))
    }

    var isExpired: Bool {
        return Date() >= expirationDate
    }
}

// MARK: - User Create Request

struct UserCreateRequest: Codable {
    let email: String
    let password: String
    let fullName: String?

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case email
        case password
        case fullName = "full_name"
    }
}

// MARK: - User Update Request

struct UserUpdateRequest: Codable {
    let fullName: String?
    let timezone: String?
    let autoTranscribe: Bool?
    let autoCreateActions: Bool?

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case fullName = "full_name"
        case timezone
        case autoTranscribe = "auto_transcribe"
        case autoCreateActions = "auto_create_actions"
    }
}

// MARK: - Password Change Request

struct PasswordChangeRequest: Codable {
    let currentPassword: String
    let newPassword: String

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case currentPassword = "current_password"
        case newPassword = "new_password"
    }
}

// MARK: - Password Reset Request

struct PasswordResetRequest: Codable {
    let email: String
}

// MARK: - Password Reset Confirm

struct PasswordResetConfirmRequest: Codable {
    let token: String
    let newPassword: String

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case token
        case newPassword = "new_password"
    }
}

// MARK: - Mock Data for Testing

#if DEBUG
extension UserResponse {
    static let mock = UserResponse(
        id: UUID(),
        email: "test@example.com",
        fullName: "Test User",
        isActive: true,
        isVerified: true,
        timezone: "America/Los_Angeles",
        autoTranscribe: true,
        autoCreateActions: true,
        createdAt: Date(),
        googleConnected: true,
        appleConnected: false
    )
}

extension Token {
    static let mock = Token(
        accessToken: "mock_access_token",
        refreshToken: "mock_refresh_token",
        tokenType: "bearer",
        expiresIn: 3600
    )
}
#endif
