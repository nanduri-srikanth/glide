//
//  APIError.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

// MARK: - API Error Response

struct APIErrorResponse: Codable, LocalizedError {
    let code: String
    let message: String
    let details: [String: String]?

    // MARK: - LocalizedError

    var errorDescription: String? {
        message
    }

    var recoverySuggestion: String? {
        details?["suggestion"]
    }

    // MARK: - Convenience Properties

    var isNetworkError: Bool {
        code == "NETWORK_ERROR"
    }

    var isAuthError: Bool {
        code == "UNAUTHORIZED" || code == "INVALID_TOKEN"
    }

    var isValidationError: Bool {
        code == "VALIDATION_ERROR"
    }

    var isNotFoundError: Bool {
        code == "NOT_FOUND"
    }

    var isServerError: Bool {
        code.hasPrefix("SERVER_")
    }
}

// MARK: - Common API Error Codes

enum APIErrorCode: String {
    // Network errors
    case networkError = "NETWORK_ERROR"
    case timeout = "TIMEOUT"
    case noConnection = "NO_CONNECTION"

    // Authentication errors
    case unauthorized = "UNAUTHORIZED"
    case invalidToken = "INVALID_TOKEN"
    case tokenExpired = "TOKEN_EXPIRED"
    case invalidCredentials = "INVALID_CREDENTIALS"

    // Validation errors
    case validationError = "VALIDATION_ERROR"
    case invalidInput = "INVALID_INPUT"
    case missingField = "MISSING_FIELD"

    // Resource errors
    case notFound = "NOT_FOUND"
    case alreadyExists = "ALREADY_EXISTS"
    case conflict = "CONFLICT"

    // Server errors
    case serverError = "SERVER_ERROR"
    case serviceUnavailable = "SERVICE_UNAVAILABLE"
    case rateLimited = "RATE_LIMITED"

    // Permission errors
    case forbidden = "FORBIDDEN"
    case insufficientPermissions = "INSUFFICIENT_PERMISSIONS"

    var localizedDescription: String {
        switch self {
        case .networkError: return "Network error. Please check your connection."
        case .timeout: return "Request timed out. Please try again."
        case .noConnection: return "No internet connection available."

        case .unauthorized: return "Unauthorized. Please log in."
        case .invalidToken: return "Invalid session. Please log in again."
        case .tokenExpired: return "Session expired. Please log in again."
        case .invalidCredentials: return "Invalid email or password."

        case .validationError: return "Invalid data provided."
        case .invalidInput: return "Invalid input format."
        case .missingField: return "Required field is missing."

        case .notFound: return "Resource not found."
        case .alreadyExists: return "Resource already exists."
        case .conflict: return "Resource conflict."

        case .serverError: return "Server error. Please try again later."
        case .serviceUnavailable: return "Service temporarily unavailable."
        case .rateLimited: return "Too many requests. Please wait."

        case .forbidden: return "Access denied."
        case .insufficientPermissions: return "You don't have permission to perform this action."
        }
    }
}

// MARK: - Standard Error

struct StandardError: Error {
    let message: String

    init(_ message: String) {
        self.message = message
    }
}
