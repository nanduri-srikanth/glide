# Glide - Native iOS Swift App

This is the **native iOS Swift/SwiftUI application** for Glide - a voice notes app with AI-powered action extraction.

## ⚠️ IMPORTANT: Project Structure

This repository contains **TWO separate frontend applications**:

1. **`Glide/Glide/`** (this directory) - Native iOS Swift/SwiftUI app
2. **Root directory** (`/`) - React Native/Expo cross-platform app

**Both frontends connect to the same backend**: `glide-backend/` (FastAPI Python server)

### Which Frontend Should You Work On?

- **Swift/SwiftUI features** → Work in `Glide/Glide/` directory
- **React Native/Expo features** → Work in the root directory
- **Backend API** → Work in `glide-backend/` directory

## Architecture Overview

```
glide/
├── Glide/Glide/          # Native iOS Swift app (THIS DIRECTORY)
│   ├── Views/            # SwiftUI views
│   ├── ViewModels/       # MVVM view models
│   ├── Services/         # Business logic (API, database, auth)
│   ├── Models/           # Data models
│   └── Utilities/        # Helpers and extensions
│
├── /                     # React Native/Expo cross-platform app
│   ├── app/              # Expo Router pages
│   ├── components/       # React components
│   ├── services/         # API, database, sync
│   └── context/          # React contexts
│
└── glide-backend/        # FastAPI backend (shared by both frontends)
    ├── app/
    │   ├── routers/      # API endpoints
    │   ├── models/       # Database models
    │   └── services/     # Business logic
    └── tests/            # Backend tests
```

## Swift Project Structure

```
Glide/Glide/
├── GlideApp.swift              # App entry point (@main)
├── ContentView.swift           # Root view
├── AppState.swift              # Global app state
├── Config.swift                # Configuration
├── DependencyContainer.swift   # Dependency injection
├── NavigationCoordinator.swift # Navigation management
│
├── Views/                      # SwiftUI Views
│   ├── NotesListView.swift     # Notes list screen
│   └── ...more views
│
├── ViewModels/                 # MVVM ViewModels
│   ├── AuthViewModel.swift     # Authentication logic
│   ├── NotesListViewModel.swift
│   ├── NoteDetailViewModel.swift
│   └── SettingsViewModel.swift
│
├── Services/                   # Business Logic Layer
│   ├── AuthService.swift       # Authentication (login/register)
│   ├── APIService.swift        # HTTP client
│   ├── Endpoints.swift         # API endpoint definitions
│   ├── UserRepository.swift    # User data access
│   ├── NotesRepository.swift   # Notes CRUD
│   ├── FoldersRepository.swift # Folders CRUD
│   ├── DatabaseManager.swift   # GRDB.swift database
│   ├── LocalNoteRepository.swift
│   ├── LocalFolderRepository.swift
│   ├── LocalActionRepository.swift
│   ├── SyncQueueRepository.swift
│   ├── KeychainService.swift   # Secure token storage
│   ├── UserDefaultsService.swift
│   ├── LoggerService.swift
│   └── VoiceService.swift      # Voice recording
│
├── Models/                     # Data Models
│   ├── User.swift
│   ├── Note.swift
│   ├── Folder.swift
│   ├── Action.swift
│   ├── Local/                  # Local database models
│   │   └── LocalModels.swift
│   └── API/                    # API response models
│       ├── UserModels.swift
│       ├── NoteModels.swift
│       ├── FolderModels.swift
│       ├── ActionModels.swift
│       └── APIError.swift
│
├── Utilities/                  # Helper Code
│   ├── Extensions.swift        # Swift extensions
│   └── Constants.swift         # App constants
│
├── Resources/                  # Assets and resources
│   └── ...
│
└── Documentation/              # Technical docs
    └── ...
```

## Technology Stack

### iOS Native
- **Language**: Swift 5.9+
- **UI Framework**: SwiftUI
- **Architecture**: MVVM (Model-View-ViewModel)
- **Minimum iOS**: iOS 15.0
- **Package Manager**: Swift Package Manager

### Dependencies (Swift Package Manager)
- **GRDB.swift** v6.0+ - Type-safe SQLite database
- **KeychainAccess** v4.0+ - Secure token storage in iOS Keychain

### Backend (Shared)
- **Framework**: FastAPI (Python)
- **API Base URL**: `http://localhost:8000` (development)
- **API Version**: v1
- **Documentation**: See `glide-backend/README.md`

## Development Setup

### Prerequisites
- macOS 13+ (Ventura or later)
- Xcode 15+ with Swift 5.9+
- iOS Simulator 15+ or physical iOS device
- Python 3.11+ (for backend)
- PostgreSQL database (local or Supabase)

### 1. Clone Repository
```bash
git clone <repository-url>
cd glide
```

### 2. Setup Backend
The Swift app requires the FastAPI backend to be running.

```bash
cd glide-backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys and database URL
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

See `glide-backend/README.md` for detailed backend setup.

### 3. Open Swift Project
```bash
# Option 1: Open in Xcode
open Glide/Glide.xcodeproj

# Option 2: Build from command line
swift build --package-path Glide
```

### 4. Configure Environment
Create `Glide/Glide/.env` (or use Xcode scheme arguments):
```bash
API_BASE_URL=http://localhost:8000
DEBUG=true
```

### 5. Run on iOS Simulator
1. Select "Glide" scheme in Xcode
2. Select iOS Simulator target (iPhone 15 or later)
3. Press ⌘R to build and run

Or from command line:
```bash
# Build
swift build --package-path Glide

# Run tests
swift test --package-path Glide
```

## Building for Production

### Xcode Archive
1. Select "Any iOS Device" as target
2. Product → Archive
3. Distribute via App Store Connect or TestFlight

### Command Line Build
```bash
# Release build
swift build --configuration release --package-path Glide

# Build for specific platform
swift build --package-path Glide \
  --destination "platform=iOS Simulator,name=iPhone 15"
```

## Key Features Implemented

### Authentication
- Email/password login
- User registration
- Token storage in iOS Keychain
- Automatic token refresh

### Notes Management
- Create, read, update, delete notes
- Voice recording with audio capture
- Folders for organization
- Action extraction (AI-powered via backend)

### Local Database
- Offline-first architecture with GRDB.swift
- Local SQLite storage
- Sync queue for offline changes
- Automatic synchronization when online

### API Integration
- RESTful API calls to FastAPI backend
- Error handling with custom APIError types
- Request/response models for type safety

## Testing

### Unit Tests
```bash
# Run all tests
swift test --package-path Glide

# Run specific test
swift test --package-path Glide --filter testUserAuthentication

# Run with verbose output
swift test --package-path Glide --verbose
```

### UI Tests
Use Xcode's UI testing framework:
```bash
open Glide/Glide.xcodeproj
# Run UI tests from Xcode Test Navigator
```

## Common Issues

### "Cannot find module 'GRDB'"
Run: `swift package resolve` from the `Glide/` directory

### Backend Connection Refused
Ensure the backend is running:
```bash
cd glide-backend
uvicorn app.main:app --reload --port 8000
```

### Keychain Access Denied
Enable Keychain entitlements in Xcode:
- Target → Signing & Capabilities → + Capability → Keychain Sharing

## Documentation

- **Backend API**: `glide-backend/README.md`
- **API Endpoints**: `http://localhost:8000/docs` (Swagger UI)
- **Architecture**: See `Glide/Glide/Documentation/`
- **Database Schema**: See `glide-backend/alembic/versions/`

## Contributing

When adding new features:

1. **Swift features** → Add code in `Glide/Glide/Views/`, `Glide/Glide/Services/`, etc.
2. **React Native features** → Add code in root `app/`, `components/`, etc.
3. **Backend features** → Add code in `glide-backend/app/`

**NEVER** mix frontend code:
- Do NOT add Swift code to the root React Native project
- Do NOT add React Native code to the `Glide/Glide/` Swift project

## License

MIT

## Contact

For questions about the Swift iOS app, check the documentation in `Glide/Glide/Documentation/`.

For backend questions, see `glide-backend/README.md`.
