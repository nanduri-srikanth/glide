//
//  Endpoint.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//
//  Type-safe API endpoint definitions with HTTP method mapping.
//  Provides comprehensive route management for all backend API endpoints.
//

import Foundation

// MARK: - API Endpoint Definitions

/// Comprehensive enum defining all API endpoints with associated values for parameters.
///
/// This enum provides type-safe route construction and HTTP method mapping for the Glide API.
/// Each case corresponds to a specific backend endpoint with support for path parameters
/// and query parameters where needed.
///
/// Usage:
/// ```swift
/// let endpoint = Endpoint.notes(page: 1, perPage: 20, folderId: "abc123")
/// let url = endpoint.buildURL(baseURL: "https://api.glide.com/api/v1")
/// let method = endpoint.method // .get
/// ```
enum Endpoint {

    // MARK: - Authentication Endpoints

    /// POST /auth/login - Login with email/password
    case login

    /// POST /auth/register - Register a new user
    case register

    /// POST /auth/refresh - Refresh access token
    case refreshToken

    /// POST /auth/logout - Logout current user
    case logout

    /// GET /auth/me - Get current user profile
    case getCurrentUser

    /// PATCH /auth/me - Update current user profile
    case updateProfile

    /// POST /auth/change-password - Change user password
    case changePassword

    /// POST /auth/apple - Apple Sign-In authentication
    case appleSignIn

    // MARK: - Notes Endpoints

    /// GET /notes - List notes with pagination and filters
    /// - Parameters:
    ///   - page: Page number (1-indexed)
    ///   - perPage: Items per page (max 100)
    ///   - folderId: Filter by folder ID
    ///   - query: Search query string
    ///   - tags: Filter by tags (comma-separated)
    ///   - isPinned: Filter by pinned status
    ///   - isArchived: Filter by archived status
    case notes(
        page: Int? = nil,
        perPage: Int? = nil,
        folderId: String? = nil,
        query: String? = nil,
        tags: [String]? = nil,
        isPinned: Bool? = nil,
        isArchived: Bool? = nil
    )

    /// POST /notes - Create a new note
    case createNote

    /// GET /notes/{id} - Get a single note by ID
    case note(id: String)

    /// PATCH /notes/{id} - Update a note
    case updateNote(id: String)

    /// DELETE /notes/{id} - Delete a note
    /// - Parameter permanent: If true, permanently deletes; otherwise soft delete
    case deleteNote(id: String, permanent: Bool = false)

    /// GET /notes/search - Search notes with pagination
    /// - Parameters:
    ///   - query: Search query string (required)
    ///   - page: Page number
    ///   - perPage: Items per page
    case notesSearch(query: String, page: Int? = nil, perPage: Int? = nil)

    /// GET /notes/search/all - Unified search across folders and notes
    /// - Parameter query: Search query string
    case notesSearchAll(query: String)

    /// POST /notes/{id}/restore - Restore a soft-deleted note
    case noteRestore(id: String)

    /// POST /notes/{id}/auto-sort - Auto-sort note to best folder using AI
    case noteAutoSort(id: String)

    // MARK: - Folders Endpoints

    /// GET /folders - List all folders with note counts
    case folders

    /// POST /folders - Create a new folder
    case createFolder

    /// GET /folders/{id} - Get a single folder by ID
    case folder(id: String)

    /// PATCH /folders/{id} - Update a folder
    case updateFolder(id: String)

    /// DELETE /folders/{id} - Delete a folder
    /// - Parameter moveNotesTo: Target folder ID to move notes to
    case deleteFolder(id: String, moveNotesTo: String? = nil)

    /// POST /folders/reorder - Bulk reorder folders
    case foldersReorder

    /// POST /folders/setup-defaults - Setup default folders for new user
    case foldersSetupDefaults

    // MARK: - Voice Processing Endpoints

    /// POST /voice/process - Process a voice memo (transcribe + extract actions)
    /// - Parameter folderId: Optional target folder for the created note
    case voiceProcess(folderId: String? = nil)

    /// POST /voice/transcribe - Transcribe audio only (preview)
    case voiceTranscribe

    /// POST /voice/analyze - Analyze transcript and extract actions
    case voiceAnalyze

    /// POST /voice/synthesize - Create note from text and/or audio
    /// - Parameter folderId: Optional target folder for the created note
    case voiceSynthesize(folderId: String? = nil)

    /// POST /voice/synthesize/{id} - Add content to existing note with smart synthesis
    /// - Parameters:
    ///   - id: Note ID to add content to
    ///   - resynthesize: If true, force full re-synthesis
    ///   - autoDecide: If true, AI decides append vs resynthesize
    case voiceSynthesizeNote(id: String, resynthesize: Bool? = nil, autoDecide: Bool? = nil)

    /// POST /voice/resynthesize/{id} - Re-synthesize note from input history
    case voiceResynthesize(id: String)

    /// POST /voice/append/{id} - Append audio recording to existing note
    case voiceAppend(id: String)

    /// GET /voice/upload-url - Get presigned URL for direct audio upload
    /// - Parameters:
    ///   - filename: Name of the file to upload
    ///   - contentType: MIME type of the audio file
    case voiceUploadURL(filename: String, contentType: String? = nil)

    /// DELETE /voice/notes/{noteId}/inputs/{inputIndex} - Delete input from note history
    case voiceDeleteInput(noteId: String, inputIndex: Int)

    // MARK: - Actions Endpoints

    /// GET /actions - List actions with filters
    /// - Parameters:
    ///   - noteId: Filter by note ID
    ///   - actionType: Filter by action type (calendar, email, reminder, next_step)
    ///   - status: Filter by status (pending, executed, failed)
    ///   - limit: Maximum number of results
    case actions(
        noteId: String? = nil,
        actionType: String? = nil,
        status: String? = nil,
        limit: Int? = nil
    )

    /// GET /actions/{id} - Get a single action by ID
    case action(id: String)

    /// PATCH /actions/{id} - Update an action
    case updateAction(id: String)

    /// DELETE /actions/{id} - Delete an action
    case deleteAction(id: String)

    /// POST /actions/{id}/execute - Execute an action
    case actionExecute(id: String)

    /// POST /actions/{id}/complete - Mark an action as complete
    case actionComplete(id: String)

    // MARK: - Integrations Endpoints

    /// GET /integrations/status - Get status of all integrations
    case integrationsStatus

    /// GET /integrations/google/connect - Start Google OAuth flow
    case googleConnect

    /// GET /integrations/google/callback - Google OAuth callback
    case googleCallback(code: String, state: String)

    /// DELETE /integrations/google - Disconnect Google integration
    case googleDisconnect

    /// GET /integrations/google/test - Test Google connection
    case googleTest

    /// POST /integrations/apple/connect - Connect Apple Calendar/Reminders
    case appleConnect

    /// DELETE /integrations/apple - Disconnect Apple integration
    case appleDisconnect

    /// GET /integrations/apple/test - Test Apple connection
    case appleTest

    // MARK: - Health & Status Endpoints

    /// GET / - API root endpoint
    case root

    /// GET /health - Health check endpoint
    case health
}

// MARK: - Path Computation

extension Endpoint {

    /// The URL path for this endpoint (without base URL or query parameters).
    var path: String {
        switch self {
        // Authentication
        case .login:
            return "/auth/login"
        case .register:
            return "/auth/register"
        case .refreshToken:
            return "/auth/refresh"
        case .logout:
            return "/auth/logout"
        case .getCurrentUser, .updateProfile:
            return "/auth/me"
        case .changePassword:
            return "/auth/change-password"
        case .appleSignIn:
            return "/auth/apple"

        // Notes
        case .notes, .createNote:
            return "/notes"
        case .note(let id), .updateNote(let id), .deleteNote(let id, _):
            return "/notes/\(id)"
        case .notesSearch, .notesSearchAll:
            return "/notes/search"
        case .noteRestore(let id):
            return "/notes/\(id)/restore"
        case .noteAutoSort(let id):
            return "/notes/\(id)/auto-sort"

        // Folders
        case .folders, .createFolder:
            return "/folders"
        case .folder(let id), .updateFolder(let id), .deleteFolder(let id, _):
            return "/folders/\(id)"
        case .foldersReorder:
            return "/folders/reorder"
        case .foldersSetupDefaults:
            return "/folders/setup-defaults"

        // Voice
        case .voiceProcess:
            return "/voice/process"
        case .voiceTranscribe:
            return "/voice/transcribe"
        case .voiceAnalyze:
            return "/voice/analyze"
        case .voiceSynthesize:
            return "/voice/synthesize"
        case .voiceSynthesizeNote(let id, _, _):
            return "/voice/synthesize/\(id)"
        case .voiceResynthesize(let id):
            return "/voice/resynthesize/\(id)"
        case .voiceAppend(let id):
            return "/voice/append/\(id)"
        case .voiceUploadURL:
            return "/voice/upload-url"
        case .voiceDeleteInput(let noteId, let inputIndex):
            return "/voice/notes/\(noteId)/inputs/\(inputIndex)"

        // Actions
        case .actions:
            return "/actions"
        case .action(let id), .updateAction(let id), .deleteAction(let id):
            return "/actions/\(id)"
        case .actionExecute(let id):
            return "/actions/\(id)/execute"
        case .actionComplete(let id):
            return "/actions/\(id)/complete"

        // Integrations
        case .integrationsStatus:
            return "/integrations/status"
        case .googleConnect:
            return "/integrations/google/connect"
        case .googleCallback:
            return "/integrations/google/callback"
        case .googleDisconnect:
            return "/integrations/google"
        case .googleTest:
            return "/integrations/google/test"
        case .appleConnect:
            return "/integrations/apple/connect"
        case .appleDisconnect:
            return "/integrations/apple"
        case .appleTest:
            return "/integrations/apple/test"

        // Health & Status
        case .root:
            return "/"
        case .health:
            return "/health"
        }
    }
}

// MARK: - HTTP Method Mapping

extension Endpoint {

    /// The HTTP method for this endpoint.
    var method: HTTPMethod {
        switch self {
        // GET endpoints
        case .getCurrentUser,
             .notes,
             .note,
             .notesSearch,
             .notesSearchAll,
             .folders,
             .folder,
             .action,
             .actions,
             .integrationsStatus,
             .googleConnect,
             .googleCallback,
             .googleTest,
             .appleTest,
             .voiceUploadURL,
             .root,
             .health:
            return .get

        // POST endpoints
        case .login,
             .register,
             .refreshToken,
             .logout,
             .changePassword,
             .appleSignIn,
             .createNote,
             .noteRestore,
             .noteAutoSort,
             .createFolder,
             .foldersReorder,
             .foldersSetupDefaults,
             .voiceProcess,
             .voiceTranscribe,
             .voiceAnalyze,
             .voiceSynthesize,
             .voiceSynthesizeNote,
             .voiceResynthesize,
             .voiceAppend,
             .actionExecute,
             .actionComplete,
             .appleConnect:
            return .post

        // PATCH endpoints
        case .updateProfile,
             .updateNote,
             .updateFolder,
             .updateAction:
            return .patch

        // DELETE endpoints
        case .deleteNote,
             .deleteFolder,
             .deleteAction,
             .googleDisconnect,
             .appleDisconnect,
             .voiceDeleteInput:
            return .delete
        }
    }
}

// MARK: - Query Parameters Support

extension Endpoint {

    /// Query parameters for this endpoint, if any.
    var queryParameters: [URLQueryItem]? {
        switch self {
        case .notes(let page, let perPage, let folderId, let query, let tags, let isPinned, let isArchived):
            var items: [URLQueryItem] = []
            if let page = page { items.append(URLQueryItem(name: "page", value: String(page))) }
            if let perPage = perPage { items.append(URLQueryItem(name: "per_page", value: String(perPage))) }
            if let folderId = folderId { items.append(URLQueryItem(name: "folder_id", value: folderId)) }
            if let query = query { items.append(URLQueryItem(name: "q", value: query)) }
            if let tags = tags, !tags.isEmpty { items.append(URLQueryItem(name: "tags", value: tags.joined(separator: ","))) }
            if let isPinned = isPinned { items.append(URLQueryItem(name: "is_pinned", value: isPinned ? "true" : "false")) }
            if let isArchived = isArchived { items.append(URLQueryItem(name: "is_archived", value: isArchived ? "true" : "false")) }
            return items.isEmpty ? nil : items

        case .deleteNote(_, let permanent):
            return permanent ? [URLQueryItem(name: "permanent", value: "true")] : nil

        case .notesSearch(let query, let page, let perPage):
            var items = [URLQueryItem(name: "q", value: query)]
            if let page = page { items.append(URLQueryItem(name: "page", value: String(page))) }
            if let perPage = perPage { items.append(URLQueryItem(name: "per_page", value: String(perPage))) }
            return items

        case .notesSearchAll(let query):
            return [URLQueryItem(name: "q", value: query)]

        case .deleteFolder(_, let moveNotesTo):
            if let targetId = moveNotesTo {
                return [URLQueryItem(name: "move_notes_to", value: targetId)]
            }
            return nil

        case .voiceUploadURL(let filename, let contentType):
            var items = [URLQueryItem(name: "filename", value: filename)]
            if let contentType = contentType {
                items.append(URLQueryItem(name: "content_type", value: contentType))
            }
            return items

        case .actions(let noteId, let actionType, let status, let limit):
            var items: [URLQueryItem] = []
            if let noteId = noteId { items.append(URLQueryItem(name: "note_id", value: noteId)) }
            if let actionType = actionType { items.append(URLQueryItem(name: "action_type", value: actionType)) }
            if let status = status { items.append(URLQueryItem(name: "status", value: status)) }
            if let limit = limit { items.append(URLQueryItem(name: "limit", value: String(limit))) }
            return items.isEmpty ? nil : items

        case .googleCallback(let code, let state):
            return [
                URLQueryItem(name: "code", value: code),
                URLQueryItem(name: "state", value: state)
            ]

        default:
            return nil
        }
    }

    /// Build a complete URL string with path and query parameters.
    /// - Parameter baseURL: The base URL to prepend (e.g., "https://api.glide.com/api/v1")
    /// - Returns: Complete URL string with path and query parameters
    func buildURL(baseURL: String) -> String {
        guard var components = URLComponents(string: baseURL + path) else {
            return baseURL + path
        }

        if let queryParams = queryParameters {
            components.queryItems = queryParams
        }

        return components.url?.absoluteString ?? (baseURL + path)
    }
}

// MARK: - URL Building Convenience

extension Endpoint {

    /// Build URLComponents for this endpoint.
    /// - Parameter baseURL: The base URL to use
    /// - Returns: URLComponents configured with path and query parameters
    func urlComponents(baseURL: String) -> URLComponents? {
        guard var components = URLComponents(string: baseURL + path) else {
            return nil
        }
        components.queryItems = queryParameters
        return components
    }

    /// Build a URL for this endpoint.
    /// - Parameter baseURL: The base URL to use
    /// - Returns: URL if construction succeeds, nil otherwise
    func url(baseURL: String) -> URL? {
        return urlComponents(baseURL: baseURL)?.url
    }
}

// MARK: - Debug Description

extension Endpoint: CustomStringConvertible {

    var description: String {
        return "\(method.rawValue) \(path)"
    }
}

// MARK: - Endpoint Categories

extension Endpoint {

    /// Category of this endpoint for grouping/logging purposes.
    var category: EndpointCategory {
        switch self {
        case .login, .register, .refreshToken, .logout, .getCurrentUser, .updateProfile, .changePassword, .appleSignIn:
            return .authentication
        case .notes, .createNote, .note, .updateNote, .deleteNote, .notesSearch, .notesSearchAll, .noteRestore, .noteAutoSort:
            return .notes
        case .folders, .createFolder, .folder, .updateFolder, .deleteFolder, .foldersReorder, .foldersSetupDefaults:
            return .folders
        case .voiceProcess, .voiceTranscribe, .voiceAnalyze, .voiceSynthesize, .voiceSynthesizeNote, .voiceResynthesize, .voiceAppend, .voiceUploadURL, .voiceDeleteInput:
            return .voice
        case .actions, .action, .updateAction, .deleteAction, .actionExecute, .actionComplete:
            return .actions
        case .integrationsStatus, .googleConnect, .googleCallback, .googleDisconnect, .googleTest, .appleConnect, .appleDisconnect, .appleTest:
            return .integrations
        case .root, .health:
            return .system
        }
    }
}

/// Categories for organizing endpoints.
enum EndpointCategory: String {
    case authentication = "Authentication"
    case notes = "Notes"
    case folders = "Folders"
    case voice = "Voice Processing"
    case actions = "Actions"
    case integrations = "Integrations"
    case system = "System"
}

// MARK: - Request Body Requirements

extension Endpoint {

    /// Whether this endpoint requires a request body.
    var requiresBody: Bool {
        switch method {
        case .post, .put, .patch:
            // Some POST endpoints don't require a body (e.g., logout)
            switch self {
            case .logout, .noteRestore, .noteAutoSort, .foldersSetupDefaults, .voiceResynthesize, .actionComplete:
                return false
            default:
                return true
            }
        default:
            return false
        }
    }

    /// Whether this endpoint involves multipart form data (file upload).
    var isMultipart: Bool {
        switch self {
        case .voiceProcess, .voiceTranscribe, .voiceSynthesize, .voiceSynthesizeNote, .voiceAppend:
            return true
        default:
            return false
        }
    }
}

// MARK: - Authentication Requirements

extension Endpoint {

    /// Whether this endpoint requires authentication.
    var requiresAuthentication: Bool {
        switch self {
        case .login, .register, .root, .health, .googleCallback:
            return false
        default:
            return true
        }
    }
}
