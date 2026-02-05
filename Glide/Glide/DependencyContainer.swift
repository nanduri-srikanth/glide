//
//  DependencyContainer.swift
//  Glide
//
//  Created by Claude on 2/5/26.
//

import Foundation

/// Dependency Injection Container
/// Provides centralized access to shared services and dependencies
class DependencyContainer {

    // MARK: - Singleton

    static let shared = DependencyContainer()

    // MARK: - Services

    /// API service for network requests
    private(set) var apiService: APIServiceProtocol

    /// Authentication service
    private(set) var authService: AuthServiceProtocol

    /// Keychain service for secure storage
    private(set) var keychainService: KeychainServiceProtocol

    /// User defaults service for preferences
    private(set) var userDefaultsService: UserDefaultsServiceProtocol

    /// Logger service
    private(set) var loggerService: LoggerServiceProtocol

    // MARK: - Database Repositories

    /// Local note repository (SQLite)
    private(set) var localNoteRepository: LocalNoteRepository?

    /// Local folder repository (SQLite)
    private(set) var localFolderRepository: LocalFolderRepository?

    /// Local action repository (SQLite)
    private(set) var localActionRepository: LocalActionRepository?

    /// Sync queue repository (SQLite)
    private(set) var syncQueueRepository: SyncQueueRepository?

    // MARK: - API Repositories

    /// User repository
    private(set) var userRepository: UserRepositoryProtocol

    /// Notes repository
    private(set) var notesRepository: NotesRepositoryProtocol

    /// Folders repository
    private(set) var foldersRepository: FoldersRepositoryProtocol

    /// Voice service
    private(set) var voiceService: VoiceServiceProtocol

    // MARK: - Initialization

    private init() {
        // Initialize services based on environment
        #if DEBUG
        self.loggerService = ConsoleLogger()
        #else
        self.loggerService = ProductionLogger()
        #endif

        self.keychainService = KeychainService()
        self.userDefaultsService = UserDefaultsService()

        // Initialize API service with configuration
        self.apiService = APIService(
            baseURL: Config.apiEndpoint,
            timeout: Config.Timeouts.defaultRequestTimeout,
            logger: self.loggerService
        )

        // Initialize auth service
        self.authService = AuthService(
            apiService: self.apiService,
            keychainService: self.keychainService,
            logger: self.loggerService
        )

        // Initialize database (will be initialized in app launch)
        self.localNoteRepository = nil
        self.localFolderRepository = nil
        self.localActionRepository = nil
        self.syncQueueRepository = nil

        // Initialize API repositories
        self.userRepository = UserRepository(
            apiService: self.apiService,
            authService: self.authService
        )

        self.notesRepository = NotesRepository(
            apiService: self.apiService,
            authService: self.authService
        )

        self.foldersRepository = FoldersRepository(
            apiService: self.apiService,
            authService: self.authService
        )

        self.voiceService = VoiceService(
            apiService: self.apiService,
            logger: self.loggerService
        )
    }

    /// Initialize database repositories (call after DatabaseManager.initialize())
    func initializeDatabaseRepositories() throws {
        let database = try DatabaseManager.shared.getDatabase()

        self.localNoteRepository = LocalNoteRepository(database: database)
        self.localFolderRepository = LocalFolderRepository(database: database)
        self.localActionRepository = LocalActionRepository(database: database)
        self.syncQueueRepository = SyncQueueRepository(database: database)

        loggerService.info("Database repositories initialized")
    }

    // MARK: - Factory Methods

    /// Create a view model with dependencies injected
    func makeAuthViewModel() -> AuthViewModel {
        return AuthViewModel(
            authService: authService,
            userDefaultsService: userDefaultsService,
            logger: loggerService
        )
    }

    func makeNotesListViewModel() -> NotesListViewModel {
        return NotesListViewModel(
            notesRepository: notesRepository,
            logger: loggerService
        )
    }

    func makeNoteDetailViewModel(noteId: String) -> NoteDetailViewModel {
        return NoteDetailViewModel(
            noteId: noteId,
            notesRepository: notesRepository,
            logger: loggerService
        )
    }

    func makeSettingsViewModel() -> SettingsViewModel {
        return SettingsViewModel(
            userDefaultsService: userDefaultsService,
            authService: authService,
            logger: loggerService
        )
    }

    // MARK: - Testing Support

    #if DEBUG
    /// Inject mock dependencies for testing
    static func setupMockContainer(
        apiService: APIServiceProtocol? = nil,
        authService: AuthServiceProtocol? = nil,
        keychainService: KeychainServiceProtocol? = nil
    ) {
        // This can be used for testing with mock services
        // Implementation depends on testing strategy
    }
    #endif
}

// MARK: - Protocol Definitions

/// API Service Protocol
protocol APIServiceProtocol {
    func request<T: Decodable>(_ endpoint: String, method: HTTPMethod, body: Data?) async throws -> T
    func upload(_ endpoint: String, data: Data) async throws -> UploadResponse
}

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

struct UploadResponse: Codable {
    let url: String
    let id: String
}

/// Authentication Service Protocol
protocol AuthServiceProtocol {
    var isAuthenticated: Bool { get }
    var currentUserId: String? { get }
    func login(email: String, password: String) async throws
    func register(email: String, password: String, name: String) async throws
    func logout() async throws
    func refreshToken() async throws
}

/// Keychain Service Protocol
protocol KeychainServiceProtocol {
    func get(key: String) -> String?
    func set(key: String, value: String) throws
    func delete(key: String) throws
}

/// User Defaults Service Protocol
protocol UserDefaultsServiceProtocol {
    func get<T>(_ key: String, defaultValue: T) -> T where T: Codable
    func set<T>(_ key: String, value: T) where T: Codable
    func remove(_ key: String)
}

/// Logger Service Protocol
protocol LoggerServiceProtocol {
    func verbose(_ message: String, file: String, function: String, line: Int)
    func debug(_ message: String, file: String, function: String, line: Int)
    func info(_ message: String, file: String, function: String, line: Int)
    func warning(_ message: String, file: String, function: String, line: Int)
    func error(_ message: String, file: String, function: String, line: Int)
}

/// User Repository Protocol
protocol UserRepositoryProtocol {
    func getCurrentUser() async throws -> User
    func updateProfile(_ user: User) async throws
}

/// Notes Repository Protocol
protocol NotesRepositoryProtocol {
    func fetchNotes() async throws -> [Note]
    func fetchNote(id: String) async throws -> Note
    func createNote(_ note: Note) async throws -> Note
    func updateNote(_ note: Note) async throws -> Note
    func deleteNote(id: String) async throws
}

/// Folders Repository Protocol
protocol FoldersRepositoryProtocol {
    func fetchFolders() async throws -> [Folder]
    func createFolder(_ folder: Folder) async throws -> Folder
    func updateFolder(_ folder: Folder) async throws -> Folder
    func deleteFolder(id: String) async throws
    func reorderFolders(_ folders: [FolderReorderItem]) async throws
}

/// Voice Service Protocol
protocol VoiceServiceProtocol {
    func transcribe(audioData: Data, filename: String) async throws -> TranscriptionResponse
    func extractActions(transcript: String) async throws -> ActionsExtraction
    func processVoiceMemo(audioData: Data, filename: String, folderId: String?) async throws -> VoiceProcessResponse
    func getUploadURL(filename: String, contentType: String?) async throws -> UploadURLResponse
    func synthesize(text: String?, audioData: Data?, filename: String?, folderId: String?) async throws -> VoiceSynthesisResponse
}
