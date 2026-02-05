//
//  Endpoints.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//  Type-safe API route definitions
//

import Foundation

// MARK: - API Endpoints

enum Endpoint {
    // Authentication
    case login
    case register
    case logout
    case refreshToken
    case getCurrentUser
    case updateProfile
    case changePassword
    case resetPassword
    case confirmResetPassword

    // Notes
    case notes
    case note(id: String)
    case notesSearch
    case notesSearchAll
    case noteRestore(id: String)
    case noteAutoSort(id: String)

    // Folders
    case folders
    case folder(id: String)
    case foldersReorder
    case foldersSetupDefaults

    // Voice
    case voiceProcess
    case voiceSynthesize
    case voiceSynthesizeNote(id: String)
    case voiceResynthesize(id: String)
    case voiceAppend(id: String)
    case voiceTranscribe
    case voiceAnalyze
    case voiceUploadURL
    case voiceDeleteInput(noteId: String, inputIndex: Int)

    // Health
    case health
    case root
}

// MARK: - Path Computation

extension Endpoint {
    var path: String {
        switch self {
        // Authentication
        case .login:
            return "/auth/login"
        case .register:
            return "/auth/register"
        case .logout:
            return "/auth/logout"
        case .refreshToken:
            return "/auth/refresh"
        case .getCurrentUser:
            return "/auth/me"
        case .updateProfile:
            return "/auth/me"
        case .changePassword:
            return "/auth/change-password"
        case .resetPassword:
            return "/auth/reset-password"
        case .confirmResetPassword:
            return "/auth/reset-password/confirm"

        // Notes
        case .notes:
            return "/notes"
        case .note(let id):
            return "/notes/\(id)"
        case .notesSearch:
            return "/notes/search"
        case .notesSearchAll:
            return "/notes/search/all"
        case .noteRestore(let id):
            return "/notes/\(id)/restore"
        case .noteAutoSort(let id):
            return "/notes/\(id)/auto-sort"

        // Folders
        case .folders:
            return "/folders"
        case .folder(let id):
            return "/folders/\(id)"
        case .foldersReorder:
            return "/folders/reorder"
        case .foldersSetupDefaults:
            return "/folders/setup-defaults"

        // Voice
        case .voiceProcess:
            return "/voice/process"
        case .voiceSynthesize:
            return "/voice/synthesize"
        case .voiceSynthesizeNote(let id):
            return "/voice/synthesize/\(id)"
        case .voiceResynthesize(let id):
            return "/voice/resynthesize/\(id)"
        case .voiceAppend(let id):
            return "/voice/append/\(id)"
        case .voiceTranscribe:
            return "/voice/transcribe"
        case .voiceAnalyze:
            return "/voice/analyze"
        case .voiceUploadURL:
            return "/voice/upload-url"
        case .voiceDeleteInput(let noteId, let inputIndex):
            return "/voice/notes/\(noteId)/inputs/\(inputIndex)"

        // Health
        case .health:
            return "/health"
        case .root:
            return "/"
        }
    }
}

// MARK: - Query Parameters Support

extension Endpoint {
    func buildQueryParams(_ params: [String: Any?]) -> [URLQueryItem] {
        return params.compactMap { key, value in
            guard let value = value else { return nil }
            if let stringValue = value as? String {
                return URLQueryItem(name: key, value: stringValue)
            } else if let intValue = value as? Int {
                return URLQueryItem(name: key, value: "\(intValue)")
            } else if let boolValue = value as? Bool {
                return URLQueryItem(name: key, value: boolValue ? "true" : "false")
            } else if let arrayValue = value as? [String] {
                return URLQueryItem(name: key, value: arrayValue.joined(separator: ","))
            }
            return nil
        }
    }
}
