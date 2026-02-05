# Development Auto-Login Feature

## Overview

The `DEV_AUTO_LOGIN` feature allows developers to skip the login screen during development for faster testing and iteration.

## Configuration

### Environment Variables

Set these in your `.env.local` file:

```bash
# Enable/disable auto-login
EXPO_PUBLIC_DEV_AUTO_LOGIN=true

# Test user credentials
EXPO_PUBLIC_DEV_TEST_EMAIL=devtest@glide.app
EXPO_PUBLIC_DEV_TEST_PASSWORD=test123
```

### Behavior

- **When `EXPO_PUBLIC_DEV_AUTO_LOGIN=true`**: App automatically logs in with test credentials on startup
- **When `EXPO_PUBLIC_DEV_AUTO_LOGIN=false`**: App shows the login screen for testing real authentication

## Testing Real Authentication

To test the actual login flow, registration, and error handling:

1. **Disable auto-login** in `.env.local`:
   ```bash
   EXPO_PUBLIC_DEV_AUTO_LOGIN=false
   ```

2. **Restart the app** (environment variables are loaded at startup)

3. **Test authentication features**:
   - Login with valid credentials
   - Login with invalid credentials (verify error messages)
   - Registration flow
   - Apple Sign-In (on iOS devices)
   - Password reset flow

## Implementation Details

### Code Location

The auto-login logic is implemented in `context/AuthContext.tsx`:

```typescript
// Lines 14-23
const DEV_AUTO_LOGIN = process.env.EXPO_PUBLIC_DEV_AUTO_LOGIN === 'true';
const DEV_TEST_EMAIL = process.env.EXPO_PUBLIC_DEV_TEST_EMAIL || 'devtest@glide.app';
const DEV_TEST_PASSWORD = process.env.EXPO_PUBLIC_DEV_TEST_PASSWORD || 'test123';
```

### Auto-Login Flow

1. App starts and `AuthProvider` initializes
2. `checkAuth()` is called to verify authentication status
3. If no existing tokens and `DEV_AUTO_LOGIN=true`:
   - Automatically logs in with test credentials
   - Fetches user data
   - Sets up default folders
4. User is immediately taken to the main app screen

### Security Considerations

⚠️ **IMPORTANT**: The auto-login feature is for **development only**. Always ensure:

- Auto-login is disabled in production builds
- Test credentials are never used in production
- `.env.local` is gitignored (credentials not committed)

## Test User Setup

### Create Test User

If the test user doesn't exist in the database, create via:

**Option 1: API**
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "devtest@glide.app",
    "password": "test123",
    "full_name": "Dev Test User"
  }'
```

**Option 2: Through the App**
1. Disable auto-login
2. Open the app
3. Click "Register"
4. Enter test credentials
5. Re-enable auto-login

## Troubleshooting

### Auto-Login Not Working

1. **Check environment variable**: Ensure `EXPO_PUBLIC_DEV_AUTO_LOGIN=true` in `.env.local`
2. **Restart app**: Environment variables are loaded at startup
3. **Check backend**: Ensure backend is running on the configured port
4. **Verify test user**: Confirm test user exists in database
5. **Check logs**: Look for `[DEV]` prefixed log messages in the console

### Can't Test Real Auth

1. **Disable auto-login**: Set `EXPO_PUBLIC_DEV_AUTO_LOGIN=false`
2. **Clear storage**: Delete app data or use `clearState` in Maestro tests
3. **Restart app**: Environment changes require restart

## Related Documentation

- [API Configuration](./API_CONFIGURATION.md) - Backend API setup
- [Error Handling](./ERROR_HANDLING.md) - Testing error responses
- [README.md](../README.md) - General development setup
