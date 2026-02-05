# Error Handling Testing Guide

## Overview

This document describes how to test the standardized error response format handling in the Glide mobile app.

## Error Response Format

The backend uses a standardized error format:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Invalid email format",
    "param": "email"
  },
  "request_id": "req_abc123",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

The frontend now correctly handles both:
1. **New standardized format**: `{ error: { message: "..." } }`
2. **Legacy FastAPI format**: `{ detail: "..." }` or `{ detail: [{ msg: "..." }] }`

## Test Scenarios

### 1. Invalid Login Credentials

**Setup:**
1. Disable auto-login: Set `EXPO_PUBLIC_DEV_AUTO_LOGIN=false` in `.env.local`
2. Restart the Expo app
3. Navigate to login screen

**Test:**
1. Enter invalid email: `invalid-email` (no @ symbol)
2. Enter invalid password: `123` (too short)
3. Tap "Login"

**Expected Result:**
- Clear error message from backend: "Invalid email format" or similar
- Error message displayed in red/error color
- No app crash or console errors

**Backend Response Example:**
```json
{
  "error": {
    "code": "validation_invalid_format",
    "message": "Invalid email format",
    "param": "email"
  }
}
```

### 2. Wrong Password

**Test:**
1. Enter valid email: `devtest@glide.app`
2. Enter wrong password: `wrongpassword123`
3. Tap "Login"

**Expected Result:**
- Error message: "Invalid email or password" or similar
- User remains on login screen
- Can retry with correct credentials

### 3. Validation Errors

**Test Registration:**
1. Go to registration screen
2. Enter weak password: `123`
3. Submit registration

**Expected Result:**
- Error message about password requirements
- Field-specific error if available

### 4. Network Errors

**Test:**
1. Stop the backend server
2. Try to login

**Expected Result:**
- Error message: "Network error" or "Unable to connect"
- Graceful handling, no crash

### 5. Apple Sign-In Errors

**Test (iOS Device Only):**
1. Tap "Sign in with Apple"
2. Cancel the Apple Sign-In dialog

**Expected Result:**
- Error message: "Sign-In was cancelled"
- Returns to login screen

## Automated Testing

### Maestro Test Flows

Create `.maestro/error-handling-test.yaml`:

```yaml
appId: com.yourapp
---
- launchApp
- assertVisible: "Welcome"
- tapOn: "Login"
- tapOn: "Email"
- inputText: "invalid-email"
- tapOn: "Password"
- inputText: "123"
- tapOn: "Login"
- assertVisible: "Invalid"  # Error message
- takeScreenshot: "error-invalid-credentials"
```

Run tests:
```bash
maestro test .maestro/error-handling-test.yaml
```

## Manual Testing Checklist

- [ ] Invalid email format shows clear error
- [ ] Short password shows validation error
- [ ] Wrong credentials show "Invalid email or password"
- [ ] Network errors show "Network error"
- [ ] Apple Sign-In cancellation shows "Sign-In was cancelled"
- [ ] Error messages are user-friendly (not technical)
- [ ] No console errors or app crashes
- [ ] Can retry after error

## Backend Error Codes

Common error codes to test:

| Code | Message | Scenario |
|------|---------|----------|
| `validation_invalid_format` | Invalid email format | Email missing @ or invalid |
| `validation_invalid_credentials` | Invalid email or password | Wrong login credentials |
| `validation_weak_password` | Password too weak | Registration with weak password |
| `auth_invalid_token` | Invalid or expired token | Expired session |
| `resource_not_found` | Resource not found | Accessing non-existent resource |

## Debugging

### Enable Detailed Logging

The frontend logs all API errors to console:

```javascript
console.log('[API] Error:', errorData);
```

Check Expo Metro logs for detailed error information.

### Test Backend Directly

```bash
# Test invalid credentials
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=wrong@email.com&password=wrong"

# Expected response:
# {"error":{"code":"validation_invalid_credentials","message":"Invalid email or password"}}
```

## Related Files

- `services/api.ts` - Core API client with error handling
- `services/auth.ts` - Auth service with login error handling
- `context/AuthContext.tsx` - Auth context with error display
- `glide-backend/app/core/errors.py` - Backend error definitions
- `glide-backend/app/core/responses.py` - Backend error response format
