//
//  User.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

/// User model representing authenticated user data
struct User: Codable, Identifiable, Equatable {
    let id: String
    let email: String
    let name: String
    let createdAt: Date
    let updatedAt: Date
    
    // Optional fields
    let avatarUrl: String?
    let emailVerified: Bool?
    let lastLoginAt: Date?
    
    enum CodingKeys: String, CodingKey {
        case id
        case email
        case name
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case avatarUrl = "avatar_url"
        case emailVerified = "email_verified"
        case lastLoginAt = "last_login_at"
    }
    
    // MARK: - Initializers
    
    init(
        id: String,
        email: String,
        name: String,
        createdAt: Date,
        updatedAt: Date,
        avatarUrl: String? = nil,
        emailVerified: Bool? = nil,
        lastLoginAt: Date? = nil
    ) {
        self.id = id
        self.email = email
        self.name = name
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.avatarUrl = avatarUrl
        self.emailVerified = emailVerified
        self.lastLoginAt = lastLoginAt
    }
}

// MARK: - Mock Data

#if DEBUG
extension User {
    static let mock = User(
        id: "user_123456",
        email: "test@example.com",
        name: "Test User",
        createdAt: Date(),
        updatedAt: Date(),
        avatarUrl: nil,
        emailVerified: true,
        lastLoginAt: Date()
    )
}
#endif
