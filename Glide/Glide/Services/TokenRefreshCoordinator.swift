//
//  TokenRefreshCoordinator.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

/// Actor-based coordinator to prevent concurrent token refresh attempts
/// Solves race condition where multiple requests trigger simultaneous refreshes
actor TokenRefreshCoordinator {

    // MARK: - Types

    private struct TokenResponse: Codable {
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

    // MARK: - Properties

    /// Current ongoing refresh task (if any)
    /// Using actor ensures this is thread-safe
    private var refreshTask: Task<TokenResponse, Error>?

    /// Metrics for monitoring
    private var refreshCount: Int = 0
    private var concurrentRequestCount: Int = 0
    private var lastRefreshDate: Date?

    // MARK: - Refresh

    /// Refresh the access token using the refresh token
    /// If a refresh is already in progress, this method will await its completion
    /// instead of starting a new refresh, preventing race conditions
    /// - Parameters:
    ///   - refreshToken: The refresh token from keychain
    ///   - apiService: The API service to use for the refresh request
    ///   - baseURL: The base URL for the API
    ///   - timeout: Maximum time to wait for refresh (default 30 seconds)
    /// - Returns: The new token response
    /// - Throws: AuthError if refresh fails or times out
    func refresh(
        using refreshToken: String,
        apiService: APIServiceProtocol,
        baseURL: String,
        timeout: TimeInterval = 30.0
    ) async throws -> TokenResponse {

        // If a refresh is already in progress, await its result
        if let existingTask = refreshTask {
            concurrentRequestCount += 1
            print("🔄 TokenRefreshCoordinator: Awaiting existing refresh task (concurrent request: \(concurrentRequestCount))")

            do {
                // Add timeout to prevent waiting forever
                let result = try await withThrowingTaskGroup(of: TokenResponse.self) { group in
                    group.addTask {
                        try await existingTask.value
                    }

                    group.addTask {
                        try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                        throw AuthError.tokenRefreshTimeout
                    }

                    // Return first result (either successful refresh or timeout)
                    let result = try await group.next()!
                    group.cancelAll()
                    return result
                }

                return result
            } catch {
                // If existing task failed, allow retry
                refreshTask = nil
                throw error
            }
        }

        // Start new refresh task
        print("🔄 TokenRefreshCoordinator: Starting new token refresh")

        let task = Task<TokenResponse, Error> {
            try await performRefresh(
                refreshToken: refreshToken,
                apiService: apiService,
                baseURL: baseURL
            )
        }

        refreshTask = task

        // Clean up task after completion (success or failure)
        defer {
            refreshTask = nil
        }

        do {
            let result = try await withThrowingTaskGroup(of: TokenResponse.self) { group in
                group.addTask {
                    try await task.value
                }

                group.addTask {
                    try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                    throw AuthError.tokenRefreshTimeout
                }

                let result = try await group.next()!
                group.cancelAll()
                return result
            }

            // Update metrics on success
            refreshCount += 1
            lastRefreshDate = Date()

            print("✅ TokenRefreshCoordinator: Refresh succeeded (total refreshes: \(refreshCount), concurrent avoided: \(concurrentRequestCount))")

            // Reset concurrent counter after successful refresh
            concurrentRequestCount = 0

            return result

        } catch {
            print("❌ TokenRefreshCoordinator: Refresh failed - \(error.localizedDescription)")
            throw error
        }
    }

    // MARK: - Private Methods

    /// Perform the actual refresh API call
    private func performRefresh(
        refreshToken: String,
        apiService: APIServiceProtocol,
        baseURL: String
    ) async throws -> TokenResponse {

        guard let url = URL(string: "\(baseURL)/auth/refresh") else {
            throw AuthError.invalidRefreshEndpoint
        }

        var request = URLRequest(url: url)
        request.httpMethod = HTTPMethod.post.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let refreshBody = ["refresh_token": refreshToken]
        request.httpBody = try? JSONEncoder().encode(refreshBody)

        // Use URLSession directly to avoid recursive calls through APIService
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30.0
        let session = URLSession(configuration: configuration)

        do {
            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw AuthError.invalidRefreshResponse
            }

            switch httpResponse.statusCode {
            case 200..<300:
                let tokenResponse = try JSONDecoder().decode(TokenResponse.self, from: data)
                return tokenResponse

            case 401:
                throw AuthError.invalidRefreshToken

            case 404:
                throw AuthError.refreshEndpointNotFound

            case 500..<600:
                throw AuthError.serverError(httpResponse.statusCode)

            default:
                throw AuthError.unknownRefreshError("Unexpected status code: \(httpResponse.statusCode)")
            }

        } catch let error as AuthError {
            throw error
        } catch {
            throw AuthError.networkError(error)
        }
    }

    // MARK: - Metrics

    /// Get current metrics for monitoring
    func getMetrics() -> (refreshCount: Int, concurrentRequestsAvoided: Int, lastRefresh: Date?) {
        return (
            refreshCount: refreshCount,
            concurrentRequestsAvoided: concurrentRequestCount,
            lastRefresh: lastRefreshDate
        )
    }

    /// Reset metrics (useful for testing)
    func resetMetrics() {
        refreshCount = 0
        concurrentRequestCount = 0
        lastRefreshDate = nil
    }
}

// MARK: - Auth Errors

extension AuthError {
    static var tokenRefreshTimeout: AuthError {
        .unknown("Token refresh timed out after 30 seconds")
    }

    static var invalidRefreshEndpoint: AuthError {
        .unknown("Invalid refresh endpoint URL")
    }

    static var invalidRefreshResponse: AuthError {
        .unknown("Invalid refresh response from server")
    }

    static var invalidRefreshToken: AuthError {
        .invalidCredentials
    }

    static var refreshEndpointNotFound: AuthError {
        .unknown("Refresh endpoint not found (404)")
    }

    static func serverError(_ code: Int) -> AuthError {
        .unknown("Server error during token refresh (\(code))")
    }

    static func networkError(_ error: Error) -> AuthError {
        .unknown("Network error during token refresh: \(error.localizedDescription)")
    }

    static func unknownRefreshError(_ message: String) -> AuthError {
        .unknown(message)
    }
}
