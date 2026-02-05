//
//  APITypes.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//
//  Shared types used across API services
//

import Foundation

// MARK: - HTTP Method

/// HTTP methods supported by the API
enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

// MARK: - Upload Response

/// Response structure for file uploads
struct UploadResponse: Codable {
    let url: String
    let id: String
}

// MARK: - API Service Protocol

/// Protocol defining the core API service interface
protocol APIServiceProtocol {
    /// Make a standard API request
    func request<T: Decodable>(
        _ endpoint: String,
        method: HTTPMethod,
        body: Data?
    ) async throws -> T
    
    /// Make an API request with custom content type
    func request<T: Decodable>(
        _ endpoint: String,
        method: HTTPMethod,
        body: Data?,
        contentType: String
    ) async throws -> T
    
    /// Upload a file
    func upload(_ endpoint: String, data: Data) async throws -> UploadResponse
    
    /// Upload voice audio with multipart form data
    func uploadVoice<T: Decodable>(
        endpoint: String,
        audioData: Data,
        filename: String,
        mimeType: String,
        additionalFields: [String: String]
    ) async throws -> T
}
