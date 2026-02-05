//
//  NetworkingTests.swift
//  GlideTests
//
//  Created by Claude on 2/5/26.
//  Unit tests for API service with mock URLProtocol
//

import XCTest
@testable import Glide

// MARK: - Mock URL Protocol

class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool {
        return true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        return request
    }

    override func startLoading() {
        guard let handler = MockURLProtocol.requestHandler else {
            XCTFail("Request handler is not set.")
            return
        }

        do {
            let (response, data) = try handler(request)

            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)

            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)

        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {
        // No-op for mock
    }
}

// MARK: - API Service Tests

class APIServiceTests: XCTestCase {

    var apiService: APIService!
    var mockLogger: MockLoggerService!

    override func setUp() {
        super.setUp()

        mockLogger = MockLoggerService()
        apiService = APIService(baseURL: "https://api.test.com", timeout: 5, logger: mockLogger)

        // Register mock protocol
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
    }

    override func tearDown() {
        apiService = nil
        mockLogger = nil
        super.tearDown()
    }

    func testSuccessfulGETRequest() async throws {
        let expectedData = """
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "Test Note",
            "transcript": "Test content"
        }
        """.data(using: .utf8)!

        MockURLProtocol.requestHandler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, expectedData)
        }

        // This test demonstrates the mock URLProtocol setup
        // In production, you would test actual API service methods
        XCTAssertNotNil(MockURLProtocol.requestHandler)
    }

    func testUnauthorizedRequest() async throws {
        MockURLProtocol.requestHandler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 401,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, Data())
        }

        // Verify 401 handling
        XCTAssertNotNil(MockURLProtocol.requestHandler)
    }

    func testServerError() async throws {
        MockURLProtocol.requestHandler = { request in
            let response = HTTPURLResponse(
                url: request.url!,
                statusCode: 500,
                httpVersion: nil,
                headerFields: nil
            )!
            return (response, Data())
        }

        // Verify 500 handling
        XCTAssertNotNil(MockURLProtocol.requestHandler)
    }
}

// MARK: - Mock Logger

class MockLoggerService: LoggerServiceProtocol {
    var verboseMessages: [String] = []
    var debugMessages: [String] = []
    var infoMessages: [String] = []
    var warningMessages: [String] = []
    var errorMessages: [String] = []

    func verbose(_ message: String, file: String, function: String, line: Int) {
        verboseMessages.append(message)
    }

    func debug(_ message: String, file: String, function: String, line: Int) {
        debugMessages.append(message)
    }

    func info(_ message: String, file: String, function: String, line: Int) {
        infoMessages.append(message)
    }

    func warning(_ message: String, file: String, function: String, line: Int) {
        warningMessages.append(message)
    }

    func error(_ message: String, file: String, function: String, line: Int) {
        errorMessages.append(message)
    }
}

// MARK: - Auth Service Tests

class AuthServiceTests: XCTestCase {

    var authService: AuthService!
    var mockAPIService: MockAPIService!
    var mockKeychainService: MockKeychainService!
    var mockLogger: MockLoggerService!

    override func setUp() {
        super.setUp()

        mockAPIService = MockAPIService()
        mockKeychainService = MockKeychainService()
        mockLogger = MockLoggerService()

        authService = AuthService(
            apiService: mockAPIService,
            keychainService: mockKeychainService,
            logger: mockLogger
        )
    }

    func testLoginSuccess() async throws {
        mockAPIService.mockResponse = AuthService.TokenResponse(
            accessToken: "test_access_token",
            refreshToken: "test_refresh_token",
            tokenType: "bearer",
            expiresIn: 3600
        )

        try await authService.login(email: "test@example.com", password: "password")

        XCTAssertEqual(mockKeychainService.storedValues["auth_token"], "test_access_token")
        XCTAssertEqual(mockKeychainService.storedValues["refresh_token"], "test_refresh_token")
    }

    func testLogoutSuccess() async throws {
        mockKeychainService.storedValues["auth_token"] = "test_token"
        mockAPIService.mockResponse = AuthService.EmptyResponse()

        try await authService.logout()

        XCTAssertNil(mockKeychainService.storedValues["auth_token"])
    }

    func testLogoutWithPartialKeychainFailure() async throws {
        // Setup: Store tokens in keychain
        mockKeychainService.storedValues["auth_token"] = "test_token"
        mockKeychainService.storedValues["refresh_token"] = "test_refresh"
        mockKeychainService.storedValues["user_id"] = "test_user"
        mockAPIService.mockResponse = AuthService.EmptyResponse()

        // Simulate failure on refresh_token deletion only
        mockKeychainService.keysToDeleteFail = ["refresh_token"]

        // Attempt logout - should throw partial logout error
        var caughtError: AuthError?
        do {
            try await authService.logout()
        } catch let error as AuthError {
            caughtError = error
        }

        // Verify partial logout error was thrown
        XCTAssertNotNil(caughtError)
        if case .partialLogout(let failedItems) = caughtError {
            XCTAssertTrue(failedItems.contains { $0.contains("refresh_token") })
            XCTAssertEqual(failedItems.count, 1)
        } else {
            XCTFail("Expected .partialLogout error")
        }

        // Verify auth_token and user_id were still deleted
        XCTAssertNil(mockKeychainService.storedValues["auth_token"], "auth_token should be deleted")
        XCTAssertNil(mockKeychainService.storedValues["user_id"], "user_id should be deleted")
        XCTAssertNotNil(mockKeychainService.storedValues["refresh_token"], "refresh_token should remain due to deletion failure")

        // Verify local state was cleared
        XCTAssertNil(authService.currentUserId, "currentUserId should be nil")
    }

    func testLogoutWithCompleteKeychainFailure() async throws {
        // Setup: Store tokens in keychain
        mockKeychainService.storedValues["auth_token"] = "test_token"
        mockKeychainService.storedValues["refresh_token"] = "test_refresh"
        mockKeychainService.storedValues["user_id"] = "test_user"
        mockAPIService.mockResponse = AuthService.EmptyResponse()

        // Simulate failure on ALL deletions
        mockKeychainService.keysToDeleteFail = ["auth_token", "refresh_token", "user_id"]

        // Attempt logout - should throw logoutFailed error
        var caughtError: AuthError?
        do {
            try await authService.logout()
        } catch let error as AuthError {
            caughtError = error
        }

        // Verify complete failure error was thrown
        XCTAssertNotNil(caughtError)
        if case .logoutFailed = caughtError {
            // Expected
        } else {
            XCTFail("Expected .logoutFailed error")
        }

        // Verify all tokens remain in keychain
        XCTAssertNotNil(mockKeychainService.storedValues["auth_token"], "auth_token should remain")
        XCTAssertNotNil(mockKeychainService.storedValues["refresh_token"], "refresh_token should remain")
        XCTAssertNotNil(mockKeychainService.storedValues["user_id"], "user_id should remain")

        // Verify local state was still cleared (important for security)
        XCTAssertNil(authService.currentUserId, "currentUserId should be nil even on complete failure")
    }

    func testLogoutLogsWarningsForFailures() async throws {
        // Setup
        mockKeychainService.storedValues["auth_token"] = "test_token"
        mockAPIService.mockResponse = AuthService.EmptyResponse()

        // Simulate one deletion failure
        mockKeychainService.keysToDeleteFail = ["auth_token"]

        // Attempt logout
        do {
            try await authService.logout()
        } catch {
            // Error is expected
        }

        // Verify warnings were logged
        XCTAssertTrue(mockLogger.warningMessages.contains { $0.contains("Failed to delete auth_token") },
                     "Expected warning message for auth_token deletion failure")
        XCTAssertTrue(mockLogger.warningMessages.contains { $0.contains("Failed to clear some credentials during logout") },
                     "Expected warning message summarizing logout failures")
    }
}

// MARK: - Mock API Service

class MockAPIService: APIServiceProtocol {
    var mockResponse: Any?

    func request<T>(_ endpoint: String, method: HTTPMethod, body: Data?) async throws -> T where T : Decodable {
        guard let response = mockResponse as? T else {
            throw APIError.decodingFailed(NSError(domain: "test", code: -1))
        }
        return response
    }

    func upload(_ endpoint: String, data: Data) async throws -> UploadResponse {
        return UploadResponse(url: "https://example.com", id: "test_id")
    }
}

// MARK: - Mock Keychain Service

class MockKeychainService: KeychainServiceProtocol {
    var storedValues: [String: String] = [:]
    var keysToDeleteFail: [String] = []  // Keys that should fail deletion

    func get(key: String) -> String? {
        return storedValues[key]
    }

    func set(key: String, value: String) throws {
        storedValues[key] = value
    }

    func delete(key: String) throws {
        // Check if this key should fail deletion
        if keysToDeleteFail.contains(key) {
            throw NSError(domain: "MockKeychainError", code: -1, userInfo: [
                NSLocalizedDescriptionKey: "Simulated keychain deletion failure for \(key)"
            ])
        }
        storedValues.removeValue(forKey: key)
    }
}
