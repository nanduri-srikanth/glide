# Glide iOS App Architecture

## Overview

The Glide iOS app follows the **Model-View-ViewModel (MVVM)** architectural pattern with **Dependency Injection** for scalable, testable, and maintainable code.

## Architecture Layers

### 1. Models (`Models/`)
**Purpose:** Data structures that represent the app's domain entities.

**Files:**
- `User.swift` - User model with preferences
- `Note.swift` - Note model with metadata
- `Folder.swift` - Folder model for organization

**Characteristics:**
- Codable for JSON serialization
- Equatable for value comparisons
- Computed properties for derived values
- Mock data for development (#if DEBUG)

### 2. Views (`Views/`)
**Purpose:** SwiftUI views that display the UI and handle user interactions.

**Files:**
- `NotesListView.swift` - Main notes list screen
- `ContentView.swift` - Placeholder/root view

**Characteristics:**
- Stateless as much as possible
- Observe ViewModels via @StateObject
- Delegate business logic to ViewModels
- Use NavigationCoordinator for navigation

### 3. ViewModels (`ViewModels/`)
**Purpose:** Bridge between Views and Services, containing presentation logic and state.

**Files:**
- `AuthViewModel.swift` - Authentication logic
- `NotesListViewModel.swift` - Notes list management
- `SettingsViewModel.swift` - Settings management

**Characteristics:**
- @MainActor for UI thread safety
- @Published properties for state observation
- Dependencies injected via init
- Async/await for network operations

### 4. Services (`Services/`)
**Purpose:** Handle business logic, API communication, and data persistence.

**Files:**
- `APIService.swift` - Network layer
- `AuthService.swift` - Authentication operations
- `KeychainService.swift` - Secure storage
- `UserDefaultsService.swift` - Preferences storage
- `LoggerService.swift` - Logging infrastructure
- `UserRepository.swift` - User data operations
- `NotesRepository.swift` - Notes data operations

**Characteristics:**
- Protocol-based for testability
- Singleton or dependency-injected instances
- Error handling with custom Error types

### 5. Utilities (`Utilities/`)
**Purpose:** Helper extensions and constants used throughout the app.

**Files:**
- `Extensions.swift` - Swift standard library extensions
- `Constants.swift` - Design, animation, and storage constants

### 6. Resources (`Resources/`)
**Purpose:** Documentation and reference materials.

**Files:**
- `ARCHITECTURE.md` - This file
- `API_REFERENCE.md` - API documentation

## Core Components

### DependencyContainer
**Location:** `DependencyContainer.swift`

The DependencyContainer is a singleton that:
- Initializes and manages all service instances
- Provides factory methods for creating ViewModels
- Handles service lifecycle
- Supports mock injection for testing

**Usage:**
```swift
// Get a ViewModel with dependencies injected
let viewModel = DependencyContainer.shared.makeNotesListViewModel()
```

### AppState
**Location:** `AppState.swift`

Global app state management that:
- Tracks authentication state
- Manages network connectivity status
- Handles theme preferences
- Coordinates global error/success messages

**Usage:**
```swift
// Update authentication
AppState.shared.setAuthenticated(true, userId: "123")

// Show error
AppState.shared.showError("Something went wrong")
```

### NavigationCoordinator
**Location:** `NavigationCoordinator.swift`

Centralized navigation management that:
- Maintains navigation stack state
- Handles sheet presentation
- Manages alerts
- Supports deep linking

**Usage:**
```swift
// Navigate to screen
NavigationCoordinator.shared.navigate(to: .noteDetail(noteId: "123"))

// Present sheet
NavigationCoordinator.shared.presentSheet(.settings)

// Handle deep link
NavigationCoordinator.shared.handleDeepLink(url)
```

### Config
**Location:** `Config.swift`

Environment configuration that:
- Defines API endpoints
- Sets feature flags
- Configures timeouts and storage limits
- Manages debug/production settings

**Usage:**
```swift
// Get API endpoint
let url = Config.apiEndpoint

// Check feature flag
if Config.FeatureFlags.enableOfflineMode {
    // Enable offline features
}
```

## Data Flow

### 1. User Action
```
View (User taps button)
    ↓
ViewModel (action method called)
    ↓
Service (business logic)
    ↓
Repository (data operation)
    ↓
API Service (network request)
```

### 2. State Update
```
API Service (receives response)
    ↓
Repository (updates cache)
    ↓
Service (returns data)
    ↓
ViewModel (updates @Published properties)
    ↓
View (reactively updates UI)
```

## Dependency Injection Pattern

### Protocol-Based Design
All services are defined as protocols:

```swift
protocol APIServiceProtocol {
    func request<T: Decodable>(_ endpoint: String, method: HTTPMethod, body: Data?) async throws -> T
}
```

### Concrete Implementations
Actual implementations conform to protocols:

```swift
class APIService: APIServiceProtocol {
    // Implementation...
}
```

### Factory Methods
DependencyContainer creates ViewModels:

```swift
func makeNotesListViewModel() -> NotesListViewModel {
    return NotesListViewModel(
        notesRepository: notesRepository,
        logger: loggerService
    )
}
```

## Folder Structure

```
Glide/
├── Glide/
│   ├── Models/           # Data models
│   ├── Views/            # SwiftUI views
│   ├── ViewModels/       # Presentation logic
│   ├── Services/         # Business logic & API
│   ├── Utilities/        # Extensions & constants
│   ├── Resources/        # Documentation
│   ├── Config.swift      # App configuration
│   ├── AppState.swift    # Global state
│   ├── DependencyContainer.swift  # DI container
│   ├── NavigationCoordinator.swift  # Navigation
│   └── GlideApp.swift    # App entry point
└── GlideTests/           # Unit tests
```

## Testing Strategy

### Unit Tests
- Test ViewModels with mock services
- Test business logic in Services
- Test Model encoding/decoding

### UI Tests
- Test user flows with XCUITest
- Verify navigation behavior
- Validate state management

### Mock Injection
```swift
#if DEBUG
static func setupMockContainer(
    apiService: APIServiceProtocol? = nil,
    authService: AuthServiceProtocol? = nil
) {
    // Inject mocks for testing
}
#endif
```

## Best Practices

### 1. SwiftUI + MVVM
- Views should be lightweight UI components
- ViewModels handle all business logic
- Use @StateObject for ViewModels
- Use @ObservedObject for shared state

### 2. Async/Await
- Use async/await for all network operations
- Mark ViewModels with @MainActor
- Handle errors gracefully with do-catch

### 3. Error Handling
- Define custom Error types for each module
- Present user-friendly error messages
- Log errors for debugging

### 4. Logging
- Use LoggerService for consistent logging
- Respect Config.logLevel
- Include context (file, function, line)

### 5. Constants
- Define magic numbers in DesignConstants
- Use named colors and sizes
- Centralize animation durations

## Getting Started

### 1. Creating a New Feature

**Step 1:** Define Model
```swift
// Models/Feature.swift
struct Feature: Codable, Identifiable {
    let id: String
    var name: String
}
```

**Step 2:** Create Service/Repository
```swift
// Services/FeatureRepository.swift
protocol FeatureRepositoryProtocol {
    func fetch() async throws -> [Feature]
}

class FeatureRepository: FeatureRepositoryProtocol {
    // Implementation...
}
```

**Step 3:** Create ViewModel
```swift
// ViewModels/FeatureViewModel.swift
@MainActor
class FeatureViewModel: ObservableObject {
    @Published var items: [Feature] = []

    private let repository: FeatureRepositoryProtocol

    init(repository: FeatureRepositoryProtocol) {
        self.repository = repository
    }
}
```

**Step 4:** Create View
```swift
// Views/FeatureView.swift
struct FeatureView: View {
    @StateObject private var viewModel: FeatureViewModel

    var body: some View {
        List(viewModel.items) { item in
            Text(item.name)
        }
    }
}
```

**Step 5:** Register in DependencyContainer
```swift
// DependencyContainer.swift
private(set) var featureRepository: FeatureRepositoryProtocol

init() {
    self.featureRepository = FeatureRepository(/* deps */)
}

func makeFeatureViewModel() -> FeatureViewModel {
    return FeatureViewModel(repository: featureRepository)
}
```

## Architecture Benefits

✅ **Testability:** Protocol-based design enables easy mocking
✅ **Maintainability:** Clear separation of concerns
✅ **Scalability:** Easy to add new features
✅ **Consistency:** Established patterns throughout
✅ **Debugging:** Centralized logging and state management
✅ **Performance:** Efficient data flow and caching

## Future Enhancements

- [ ] Add Core Data persistence layer
- [ ] Implement offline sync queue
- [ ] Add analytics service
- [ ] Implement crash reporting
- [ ] Add A/B testing framework
- [ ] Create widget extensions
