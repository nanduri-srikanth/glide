//
//  APIService.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

/// API Service for making network requests
class APIService: APIServiceProtocol {

    // MARK: - Properties

    private let baseURL: String
    private let timeout: TimeInterval
    private let logger: LoggerServiceProtocol

    private let urlSession: URLSession
    private let keychainService: KeychainServiceProtocol
    private var isRefreshing = false

    // MARK: - Initialization

    init(baseURL: String, timeout: TimeInterval, logger: LoggerServiceProtocol) {
        self.baseURL = baseURL
        self.timeout = timeout
        self.logger = logger
        self.keychainService = KeychainService()

        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = timeout
        configuration.timeoutIntervalForResource = timeout * 2
        self.urlSession = URLSession(configuration: configuration)
    }

    // MARK: - Request Methods

    func request<T: Decodable>(
        _ endpoint: String,
        method: HTTPMethod,
        body: Data? = nil
    ) async throws -> T {

        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body = body {
            request.httpBody = body
        }

        // Add auth token if available
        if let token = KeychainService().get(key: "auth_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        logger.debug("API Request: \(method.rawValue) \(url.absoluteString)", file: #file, function: #function, line: #line)

        do {
            let (data, response) = try await urlSession.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            logger.debug("API Response: \(httpResponse.statusCode)", file: #file, function: #function, line: #line)

            switch httpResponse.statusCode {
            case 200..<300:
                do {
                    let decoded = try JSONDecoder().decode(T.self, from: data)
                    return decoded
                } catch {
                    logger.error("Failed to decode response: \(error.localizedDescription)", file: #file, function: #function, line: #line)
                    throw APIError.decodingFailed(error)
                }

            case 401:
                // Attempt token refresh on 401 Unauthorized
                if try await refreshAccessTokenAndRetry(endpoint, method: method, body: body) as? T != nil {
                    return try await request(endpoint, method: method, body: body)
                }
                throw APIError.unauthorized

            case 403:
                throw APIError.forbidden

            case 404:
                throw APIError.notFound

            case 500..<600:
                throw APIError.serverError(httpResponse.statusCode)

            default:
                throw APIError.unknownError
            }

        } catch let error as APIError {
            throw error
        } catch {
            logger.error("Network error: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            throw APIError.networkError(error)
        }
    }

    func upload(_ endpoint: String, data: Data) async throws -> UploadResponse {
        // Implementation for file uploads
        fatalError("Upload not implemented yet")
    }

    // MARK: - Token Refresh

    private func refreshAccessTokenAndRetry<T: Decodable>(
        _ endpoint: String,
        method: HTTPMethod,
        body: Data?
    ) async throws -> T? {

        // Prevent concurrent refresh attempts
        guard !isRefreshing else {
            return nil
        }

        isRefreshing = true
        defer { isRefreshing = false }

        guard let refreshToken = keychainService.get(key: "refresh_token") else {
            return nil
        }

        logger.debug("Attempting token refresh", file: #file, function: #function, line: #line)

        // Create refresh request
        guard let url = URL(string: "\(baseURL)/auth/refresh") else {
            return nil
        }

        var request = URLRequest(url: url)
        request.httpMethod = HTTPMethod.post.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let refreshBody = ["refresh_token": refreshToken]
        request.httpBody = try? JSONEncoder().encode(refreshBody)

        do {
            let (data, response) = try await urlSession.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                logger.warning("Token refresh failed", file: #file, function: #function, line: #line)
                return nil
            }

            let tokenResponse = try JSONDecoder().decode(TokenRefreshResponse.self, from: data)

            // Save new tokens
            try keychainService.set(key: "auth_token", value: tokenResponse.accessToken)
            try keychainService.set(key: "refresh_token", value: tokenResponse.refreshToken)

            logger.info("Token refreshed successfully", file: #file, function: #function, line: #line)

            // Return retry success indicator
            return nil

        } catch {
            logger.error("Token refresh error: \(error.localizedDescription)", file: #file, function: #function, line: #line)
            return nil
        }
    }
}

// MARK: - Token Refresh Response

private struct TokenRefreshResponse: Codable {
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

// MARK: - API Errors

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case decodingFailed(Error)
    case unauthorized
    case forbidden
    case notFound
    case serverError(Int)
    case networkError(Error)
    case unknownError

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .decodingFailed(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .unauthorized:
            return "Unauthorized. Please log in again."
        case .forbidden:
            return "You don't have permission to access this resource"
        case .notFound:
            return "Resource not found"
        case .serverError(let code):
            return "Server error (\(code)). Please try again later."
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .unknownError:
            return "An unknown error occurred"
        }
    }
}
