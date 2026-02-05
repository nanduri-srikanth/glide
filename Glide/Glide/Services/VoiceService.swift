//
//  VoiceService.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Voice processing and transcription service
//

import Foundation

/// Voice Service for processing audio and transcribing
class VoiceService: VoiceServiceProtocol {

    // MARK: - Properties

    private let apiService: APIServiceProtocol
    private let logger: LoggerServiceProtocol

    // MARK: - Initialization

    init(apiService: APIServiceProtocol, logger: LoggerServiceProtocol) {
        self.apiService = apiService
        self.logger = logger
    }

    // MARK: - Transcription

    func transcribe(audioData: Data, filename: String) async throws -> TranscriptionResponse {
        let boundary = UUID().uuidString
        var body = Data()

        // Add audio file
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"audio_file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/m4a\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n".data(using: .utf8)!)

        // Close boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        logger.debug("Transcribing audio: \(filename)", file: #file, function: #function, line: #line)

        return try await uploadMultipart(
            endpoint: Endpoint.voiceTranscribe.path,
            body: body,
            boundary: boundary
        )
    }

    func extractActions(transcript: String) async throws -> ActionsExtraction {
        let bodyString = "transcript=\(transcript.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? transcript)"
        let body = bodyString.data(using: .utf8)!

        logger.debug("Extracting actions from transcript", file: #file, function: #function, line: #line)

        return try await apiService.request(
            Endpoint.voiceAnalyze.path,
            method: .post,
            body: body
        )
    }

    func processVoiceMemo(
        audioData: Data,
        filename: String,
        folderId: String?
    ) async throws -> VoiceProcessResponse {
        let boundary = UUID().uuidString
        var body = Data()

        // Add audio file
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"audio_file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/m4a\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n".data(using: .utf8)!)

        // Add folder_id if provided
        if let folderId = folderId {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"folder_id\"\r\n\r\n".data(using: .utf8)!)
            body.append(folderId.data(using: .utf8)!)
            body.append("\r\n".data(using: .utf8)!)
        }

        // Close boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        logger.debug("Processing voice memo: \(filename)", file: #file, function: #function, line: #line)

        return try await uploadMultipart(
            endpoint: Endpoint.voiceProcess.path,
            body: body,
            boundary: boundary
        )
    }

    func getUploadURL(filename: String, contentType: String? = nil) async throws -> UploadURLResponse {
        let contentType = contentType ?? "audio/mpeg"
        let params = [
            "filename": filename,
            "content_type": contentType
        ]

        var components = URLComponents(string: Endpoint.voiceUploadURL.path)
        components?.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }

        guard let url = components?.url?.absoluteString else {
            throw APIError.invalidURL
        }

        return try await apiService.request(url, method: .get, body: nil)
    }

    // MARK: - Synthesis

    func synthesize(
        text: String?,
        audioData: Data?,
        filename: String?,
        folderId: String?
    ) async throws -> VoiceSynthesisResponse {
        let boundary = UUID().uuidString
        var body = Data()

        // Add text input if provided
        if let text = text {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"text_input\"\r\n\r\n".data(using: .utf8)!)
            body.append(text.data(using: .utf8)!)
            body.append("\r\n".data(using: .utf8)!)
        }

        // Add audio file if provided
        if let audioData = audioData, let filename = filename {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"audio_file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: audio/m4a\r\n\r\n".data(using: .utf8)!)
            body.append(audioData)
            body.append("\r\n".data(using: .utf8)!)
        }

        // Add folder_id if provided
        if let folderId = folderId {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"folder_id\"\r\n\r\n".data(using: .utf8)!)
            body.append(folderId.data(using: .utf8)!)
            body.append("\r\n".data(using: .utf8)!)
        }

        // Close boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        logger.debug("Synthesizing content", file: #file, function: #function, line: #line)

        return try await uploadMultipart(
            endpoint: Endpoint.voiceSynthesize.path,
            body: body,
            boundary: boundary
        )
    }

    // MARK: - Private Helper Methods

    private func uploadMultipart<T: Decodable>(
        endpoint: String,
        body: Data,
        boundary: String
    ) async throws -> T {

        guard let url = URL(string: "\(Config.apiEndpoint)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = HTTPMethod.post.rawValue
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(KeychainService().get(key: "auth_token") ?? "")", forHTTPHeaderField: "Authorization")
        request.httpBody = body

        logger.debug("API Request: POST \(url.absoluteString)", file: #file, function: #function, line: #line)

        let (data, response) = try await URLSession.shared.data(for: request)

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
    }
}

// MARK: - Response Types

struct TranscriptionResponse: Codable {
    let text: String
    let language: String
    let duration: Int
}

struct ActionsExtraction: Codable {
    let title: String
    let folder: String?
    let tags: [String]
    let summary: String
    let calendar: [CalendarAction]
    let email: [EmailAction]
    let reminders: [ReminderAction]
    let nextSteps: [String]
}

struct CalendarAction: Codable {
    let title: String
    let date: String
    let time: String
    let location: String?
    let attendees: [String]
}

struct EmailAction: Codable {
    let to: String
    let subject: String
    let body: String
}

struct ReminderAction: Codable {
    let title: String
    let dueDate: String
    let dueTime: String
    let priority: String
}

struct VoiceProcessResponse: Codable {
    let noteId: String
    let title: String
    let transcript: String
    let summary: String
    let duration: Int
    let folderId: String?
    let folderName: String?
    let tags: [String]
    let actions: ActionsExtraction
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case noteId = "note_id"
        case title
        case transcript
        case summary
        case duration
        case folderId = "folder_id"
        case folderName = "folder_name"
        case tags
        case actions
        case createdAt = "created_at"
    }
}

struct VoiceSynthesisResponse: Codable {
    let noteId: String
    let title: String
    let narrative: String
    let rawInputs: [RawInput]
    let summary: String
    let duration: Int
    let folderId: String?
    let folderName: String?
    let tags: [String]
    let actions: ActionsExtraction
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case noteId = "note_id"
        case title
        case narrative
        case rawInputs = "raw_inputs"
        case summary
        case duration
        case folderId = "folder_id"
        case folderName = "folder_name"
        case tags
        case actions
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct RawInput: Codable {
    let type: String
    let content: String
    let timestamp: Date
    let duration: Int?
    let audioKey: String?

    enum CodingKeys: String, CodingKey {
        case type
        case content
        case timestamp
        case duration
        case audioKey = "audio_key"
    }
}

struct UploadURLResponse: Codable {
    let url: String
    let key: String
    let fields: [String: String]?
}

// MARK: - Protocol Definition

protocol VoiceServiceProtocol {
    func transcribe(audioData: Data, filename: String) async throws -> TranscriptionResponse
    func extractActions(transcript: String) async throws -> ActionsExtraction
    func processVoiceMemo(audioData: Data, filename: String, folderId: String?) async throws -> VoiceProcessResponse
    func getUploadURL(filename: String, contentType: String?) async throws -> UploadURLResponse
    func synthesize(text: String?, audioData: Data?, filename: String?, folderId: String?) async throws -> VoiceSynthesisResponse
}
