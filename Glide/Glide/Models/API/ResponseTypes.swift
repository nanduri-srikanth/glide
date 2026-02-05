//
//  ResponseTypes.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Generic API response wrapper types
//

import Foundation

// MARK: - Generic API Response

/// Generic wrapper for API responses
struct APIResponse<T: Codable>: Codable {
    let data: T
    let message: String?
    let code: String?

    enum CodingKeys: String, CodingKey {
        case data
        case message
        case code
    }

    init(data: T, message: String? = nil, code: String? = nil) {
        self.data = data
        self.message = message
        self.code = code
    }
}

// MARK: - Paginated Response

/// Generic wrapper for paginated API responses
struct PaginatedResponse<T: Codable>: Codable {
    let items: [T]
    let total: Int
    let page: Int
    let perPage: Int
    let pages: Int

    enum CodingKeys: String, CodingKey {
        case items
        case total
        case page
        case perPage = "per_page"
        case pages
    }

    init(items: [T], total: Int, page: Int, perPage: Int, pages: Int) {
        self.items = items
        self.total = total
        self.page = page
        self.perPage = perPage
        self.pages = pages
    }

    // MARK: - Computed Properties

    var hasMorePages: Bool {
        page < pages
    }

    var isLastPage: Bool {
        page >= pages
    }

    var isFirstPage: Bool {
        page == 1
    }

    var hasNextPage: Bool {
        page < pages
    }

    var hasPreviousPage: Bool {
        page > 1
    }
}

// MARK: - Empty Response

/// Response for requests that don't return data (e.g., DELETE)
struct EmptyResponse: Codable {
    let message: String?
    let code: String?

    init(message: String? = nil, code: String? = nil) {
        self.message = message
        self.code = code
    }
}

// MARK: - Batch Response

/// Response for batch operations
struct BatchResponse<T: Codable>: Codable {
    let succeeded: [T]
    let failed: [BatchError]
    let total: Int
    let successCount: Int
    let failureCount: Int

    enum CodingKeys: String, CodingKey {
        case succeeded
        case failed
        case total
        case successCount = "success_count"
        case failureCount = "failure_count"
    }

    var allSucceeded: Bool {
        failureCount == 0
    }
}

// MARK: - Batch Error

struct BatchError: Codable, LocalizedError {
    let id: String?
    let error: String
    let message: String

    var errorDescription: String? {
        message
    }
}

// MARK: - Mock Data for Testing

#if DEBUG
extension APIResponse {
    static func mock(data: T, message: String? = "Success") -> APIResponse<T> {
        APIResponse(data: data, message: message, code: "SUCCESS")
    }
}

extension PaginatedResponse {
    static func mock(items: [T], page: Int = 1, perPage: Int = 20) -> PaginatedResponse<T> {
        let total = items.count
        let pages = (total + perPage - 1) / perPage
        return PaginatedResponse(items: items, total: total, page: page, perPage: perPage, pages: max(1, pages))
    }
}

extension BatchResponse {
    static func mock(succeeded: [T], failed: [BatchError] = []) -> BatchResponse<T> {
        BatchResponse(
            succeeded: succeeded,
            failed: failed,
            total: succeeded.count + failed.count,
            successCount: succeeded.count,
            failureCount: failed.count
        )
    }
}
#endif
