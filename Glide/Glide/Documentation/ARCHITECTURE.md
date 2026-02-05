# Glide Project Architecture

## Dual Frontend Architecture

The Glide project uses a **dual frontend** approach to serve different needs:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Glide Repository                            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         React Native/Expo Frontend (Root Dir)           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │   │
│  │  │   iOS    │  │  Android │  │         Web          │  │   │
│  │  │          │  │          │  │                      │  │   │
│  │  └──────────┘  └──────────┘  └──────────────────────┘  │   │
│  │                                                          │   │
│  │  - Cross-platform (JavaScript/TypeScript)                │   │
│  │  - Fast development cycles                               │   │
│  │  - Expo for easy deployment                             │   │
│  │  - Great for rapid prototyping                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ HTTP/REST                        │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              FastAPI Backend (glide-backend/)            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │    Auth      │  │   Voice AI   │  │   Sync API   │  │   │
│  │  │   Service    │  │   Service    │  │   Service    │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │                                                          │   │
│  │  - Python 3.11+                                          │   │
│  │  - PostgreSQL database                                   │   │
│  │  - OpenAI Whisper (transcription)                        │   │
│  │  - Anthropic Claude (AI actions)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ HTTP/REST                        │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Native iOS Swift Frontend (Glide/Glide/)         │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │          SwiftUI Views (iOS only)                │   │   │
│  │  │                                                  │   │   │
│  │  │  - Native performance                            │   │   │
│  │  │  - Platform-specific features (Voice, Haptics)   │   │   │
│  │  │  - GRDB.swift for local SQLite                   │   │   │
│  │  │  - KeychainAccess for secure storage             │   │   │
│  │  │  - Offline-first architecture                    │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Why Two Frontends?

### React Native/Expo (Root Directory)
**Use case**: Cross-platform development, rapid iteration

**Advantages:**
- Single codebase for iOS, Android, and Web
- Fast development with hot reload
- Large ecosystem of npm packages
- Easier to find React Native developers
- Expo for simplified deployment

**Best for:**
- MVP and rapid prototyping
- Teams with JavaScript experience
- Projects requiring Android support
- Quick feature iteration

### Native iOS Swift (Glide/Glide/)
**Use case**: Native iOS experience, platform-specific features

**Advantages:**
- Native performance and smoothness
- Full access to iOS platform APIs
- Type-safe Swift language
- Better integration with iOS features (Voice, Haptics, Widgets)
- More robust offline support with GRDB.swift

**Best for:**
- Production iOS app with focus on UX
- Teams with Swift/iOS experience
- Projects requiring deep iOS integration
- Long-term maintenance and stability

## Shared Backend

Both frontends connect to the **same FastAPI backend** in `glide-backend/`:

### API Endpoints
```
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/notes
POST /api/v1/notes
GET  /api/v1/folders
POST /api/v1/voice/process
...and more
```

### Database
- **PostgreSQL** (Supabase or local)
- **Tables**: users, notes, folders, actions, sync_queue
- **Migrations**: Alembic

See `glide-backend/README.md` for full API documentation.

## Data Flow

### React Native Flow
```
User Input → React Component → Context State → API Service → Backend → PostgreSQL
                                                        ↓
                                                  AsyncStorage (offline cache)
```

### Swift Flow
```
User Input → SwiftUI View → ViewModel → Repository → Backend → PostgreSQL
                                          ↓
                                    GRDB.swift (local SQLite)
                                          ↓
                                    SyncQueue (pending changes)
```

## Feature Comparison

| Feature | React Native | Native iOS Swift |
|---------|--------------|------------------|
| Cross-platform | ✅ iOS, Android, Web | ❌ iOS only |
| Native Performance | ⚠️ Bridge overhead | ✅ True native |
| Offline Support | ⚠️ AsyncStorage | ✅ GRDB SQLite |
| Voice Recording | ⚠️ React Native plugins | ✅ AVFoundation |
| Platform APIs | ⚠️ Limited via plugins | ✅ Full access |
| Development Speed | ✅ Fast iteration | ⚠️ Slower (native) |
| Type Safety | ⚠️ TypeScript | ✅ Swift |
| Ecosystem | ✅ npm (large) | ⚠️ SPM (smaller) |
| Deployment | ✅ Expo EAS | ⚠️ App Store Connect |

## Development Workflow

### Adding a New Feature

1. **Backend First** (always):
   ```bash
   cd glide-backend
   # Add API endpoint, schema, service
   # Run tests
   ```

2. **Choose Frontend**:
   - Need cross-platform? → React Native
   - iOS-only with best UX? → Swift

3. **Implement**:
   - React Native: `app/`, `components/`, `services/`
   - Swift: `Glide/Glide/Views/`, `Glide/Glide/Services/`

4. **Test**:
   - React Native: Maestro flows, Jest
   - Swift: XCTest, SwiftUI previews

### File Location Rules

**NEVER mix frontends:**

❌ **WRONG:**
```bash
# Adding Swift files to React Native project
/app/MembersService.swift  # NO!

# Adding React files to Swift project
Glide/Glide/components/  # NO!
```

✅ **CORRECT:**
```bash
# React Native features
/app/(tabs)/notes.tsx
/components/NoteCard.tsx
services/api.ts

# Swift features
Glide/Glide/Views/NotesListView.swift
Glide/Glide/Services/NotesRepository.swift
```

## API Compatibility

Both frontends use the **same API contract**:

### Request Format
```json
{
  "method": "POST",
  "url": "http://localhost:8000/api/v1/notes",
  "headers": {
    "Authorization": "Bearer <token>"
  },
  "body": {
    "title": "My Note",
    "content": "Note content"
  }
}
```

### Response Format
```json
{
  "id": 123,
  "title": "My Note",
  "content": "Note content",
  "created_at": "2024-01-15T10:30:00Z"
}
```

Both frontends must handle:
- Authentication (JWT tokens)
- Error responses (400, 401, 403, 404, 500)
- Pagination
- Offline sync

## Testing Strategy

### Backend Tests
```bash
cd glide-backend
pytest  # Python tests
```

### React Native Tests
```bash
# Unit tests
npm test

# UI tests (Maestro)
maestro test .maestro/
```

### Swift Tests
```bash
# Unit tests
swift test --package-path Glide

# UI tests (XCTest)
# Run from Xcode
```

## Deployment

### React Native
- **iOS**: Expo EAS Build → TestFlight → App Store
- **Android**: Expo EAS Build → Google Play Store
- **Web**: Expo web hosting

### Swift
- **iOS**: Xcode Archive → TestFlight → App Store
- **Mac**: Archive → Mac App Store (optional)

### Backend
- **AWS Lambda** (serverless)
- **Railway/Render** (PaaS)
- **Docker** (self-hosted)

## Summary

- **2 Frontends**: React Native (cross-platform) + Swift (iOS-native)
- **1 Backend**: FastAPI Python server
- **1 Database**: PostgreSQL shared by both
- **Separation**: Keep code in correct directory
- **API**: Same REST API for both frontends

When in doubt: **Check the directory!**

- Root `/` → React Native
- `Glide/Glide/` → Swift
- `glide-backend/` → Backend API

---

For detailed setup instructions:
- React Native: See root `README.md`
- Swift: See `Glide/Glide/README.md`
- Backend: See `glide-backend/README.md`
