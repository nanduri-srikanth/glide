# Glide Testing Documentation

This document provides a comprehensive overview of the testing infrastructure and test suites for the Glide application.

## Overview

Glide uses a multi-layer testing approach covering both frontend (React Native/Expo) and backend (FastAPI/Python) components.

| Component | Framework | Location | Status |
|-----------|-----------|----------|--------|
| Frontend | Jest + Testing Library | `/__tests__/` | ✅ 58 tests |
| Backend | pytest | `/glide-backend/tests/` | ✅ 150+ tests |

## Frontend Testing

### Setup

The frontend uses Jest with the following configuration:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Configuration

- **Config file**: `jest.config.js`
- **Setup file**: `jest.setup.js`
- **Test location**: `__tests__/` directory

### Test Suites

#### 1. Utility Tests (`__tests__/utils/`)

**`textUtils.test.ts`** - 20 tests
- `generateTitleFromContent` - Title generation from note content
  - Empty content handling
  - First line extraction
  - Sentence boundary detection
  - Word boundary truncation
  - Whitespace handling
- `isUserSetTitle` - User-set title detection
  - Placeholder detection (Untitled, New Note, etc.)
  - Custom title recognition
- `shouldAutoGenerateTitle` - Auto-generation logic
  - Content-based decisions
  - Placeholder detection integration

#### 2. Service Tests (`__tests__/services/`)

**`api.test.ts`** - Token management and HTTP methods
- Token management
  - Authentication status tracking
  - Token storage and retrieval
- HTTP methods (GET, POST, PATCH, DELETE)
  - Request construction
  - Authorization header injection
- Error handling
  - HTTP errors (404, 422, 500)
  - Pydantic validation errors
  - Network failures
- Token refresh
  - Automatic refresh on 401
  - Retry logic
  - Failure handling

**`notes.test.ts`** - Notes service operations
- List notes with filters
- Get single note
- Create/Update/Delete notes
- Folder operations
- Data conversion (API → App format)
- Search functionality

### Mocking Strategy

The frontend tests mock:
- `expo-secure-store` - Token storage
- `react-native` Platform - OS detection
- `expo-av` - Audio recording
- `expo-haptics` - Haptic feedback
- `expo-router` - Navigation
- `global.fetch` - Network requests

## Backend Testing

### Setup

```bash
cd glide-backend

# Install dependencies
pip install -r requirements.txt

# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_auth.py -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html
```

### Test Suites

#### 1. Authentication Tests (`tests/test_auth.py`)

**User Registration**
- Successful registration
- Registration without optional fields
- Duplicate email rejection
- Invalid email format validation
- Password validation

**User Login**
- Successful login with correct credentials
- Wrong password rejection
- Non-existent user handling
- Missing fields validation

**Token Refresh**
- Successful token refresh
- Invalid token rejection
- Using access token as refresh (should fail)

**Current User**
- Authenticated profile access
- Unauthenticated access denial
- Invalid token handling

**Profile Update**
- Full name update
- Timezone update
- Auto-settings update

**Password Change**
- Successful password change
- Wrong current password rejection

**Logout**
- Authenticated logout
- Unauthenticated logout handling

**Apple Sign-In**
- Invalid token handling

#### 2. Notes Tests (`tests/test_notes.py`)

**List Notes**
- Empty list handling
- With data listing
- Pagination
- Folder filtering
- Pinned filtering
- Search functionality
- Authentication requirement

**Get Note**
- Single note retrieval
- Not found handling
- Cross-user access prevention

**Create Note**
- Basic creation
- With folder
- With tags
- Invalid folder handling
- Missing fields validation

**Update Note**
- Title update
- Transcript update
- Pin/Unpin
- Archive/Unarchive
- Tags update
- Folder move
- Not found handling

**Delete Note**
- Soft delete
- Permanent delete
- Not found handling

**Restore Note**
- Restore deleted note
- Restore non-deleted note (should fail)

**Search Notes**
- Title search
- Transcript search
- Case insensitive search
- No results handling

#### 3. Folders Tests (`tests/test_folders.py`)

**List Folders**
- Empty list
- With data
- Hierarchical structure
- Authentication requirement

**Get Folder**
- Single folder retrieval
- Not found handling
- Note count accuracy

**Create Folder**
- Basic creation
- Minimal data creation
- Nested folder creation
- Duplicate name rejection
- Max depth enforcement
- Invalid parent handling

**Update Folder**
- Name update
- Icon update
- Color update
- Parent change (nesting)
- Duplicate name rejection
- Not found handling
- Self-nesting prevention

**Delete Folder**
- Successful deletion
- Notes handling after deletion
- Not found handling

**Default Folders Setup**
- Initial setup
- Idempotency

**Folder Reordering**
- Sort order update
- Nesting changes

#### 4. Actions Tests (`tests/test_actions.py`)

**List Actions**
- Empty list
- With filters (type, status, note_id)
- Limit parameter
- Authentication requirement

**Get Action**
- Not found handling
- Authentication requirement

**Update Action**
- Not found handling
- Authentication requirement

**Delete Action**
- Not found handling
- Authentication requirement

**Execute Action**
- Not found handling
- Missing service parameter
- Authentication requirement

**Complete Action**
- Not found handling
- Authentication requirement

**Integration Tests**
- Filter combinations
- Valid action types
- Valid status values
- Invalid UUID handling

## Test Database

Both frontend and backend tests use isolated test databases:

- **Frontend**: Mocked API responses (no actual database)
- **Backend**: SQLite in-memory database per test

## Coverage Goals

| Component | Target | Current |
|-----------|--------|---------|
| Frontend Utils | 90% | ~95% |
| Frontend Services | 80% | ~85% |
| Backend Auth | 85% | ~90% |
| Backend Notes | 85% | ~90% |
| Backend Folders | 85% | ~90% |
| Backend Actions | 80% | ~85% |

## Adding New Tests

### Frontend

1. Create test file in `__tests__/<category>/`
2. Use `.test.ts` or `.test.tsx` extension
3. Import necessary mocks from `jest.setup.js`
4. Follow existing patterns for describe/it blocks

```typescript
describe('FeatureName', () => {
  describe('subFeature', () => {
    it('should do something', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Backend

1. Create test file in `glide-backend/tests/`
2. Use `test_<feature>.py` naming
3. Use fixtures from `conftest.py`
4. Follow existing patterns for test classes

```python
class TestFeature:
    def test_something(self, client, auth_headers):
        response = client.get("/api/v1/endpoint", headers=auth_headers)
        assert response.status_code == 200
```

## CI/CD Integration

Tests should be run in CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run Frontend Tests
  run: npm test

- name: Run Backend Tests
  run: |
    cd glide-backend
    pytest tests/ -v --tb=short
```

## Troubleshooting

### Frontend

**"__DEV__ is not defined"**
- Ensure `global.__DEV__ = true` is in `jest.setup.js`

**Module not found errors**
- Check `moduleNameMapper` in `jest.config.js`
- Ensure mocks are properly set up in `jest.setup.js`

### Backend

**Database-related errors**
- Ensure test database URL uses SQLite
- Check that `Base.metadata.create_all()` is called in fixtures

**Import errors**
- Install all dependencies: `pip install -r requirements.txt`
- Ensure you're in the `glide-backend` directory
