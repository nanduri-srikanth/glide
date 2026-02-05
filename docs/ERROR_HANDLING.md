# Error Handling Documentation

## Backend Error Format

The Glide backend uses a standardized error response format:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Invalid email or password",
    "param": "email",
    "details": ["Additional error details"]
  }
}
```

### Error Categories

- **Validation Errors** (400): Invalid input, missing fields, weak passwords
- **Authentication Errors** (401): Invalid tokens, expired tokens
- **Authorization Errors** (403): Permission denied, inactive account
- **Not Found Errors** (404): Resource not found
- **Conflict Errors** (409): Duplicate resources
- **Rate Limit Errors** (429): Too many requests
- **External Service Errors** (502/503): Third-party service failures
- **Internal Errors** (500): Server errors

## Frontend Error Handling

The frontend (`services/api.ts` and `services/auth.ts`) handles both the new standardized format and legacy FastAPI format for backward compatibility.

### Error Response Parsing

```typescript
// services/api.ts
if (errorData.error?.message) {
  // New standardized format
  message = errorData.error.message;
} else if (typeof errorData.detail === 'string') {
  // Legacy FastAPI format
  message = errorData.detail;
} else if (Array.isArray(errorData.detail)) {
  // Pydantic validation errors
  const firstError = errorData.detail[0];
  message = firstError.msg || firstError.message || 'Validation error';
}
```

### Testing Error Handling

Use the Maestro test flow to verify error messages display correctly:

```bash
maestro test .maestro/error-handling-test.yaml
```

This test verifies:
1. Invalid email format validation
2. Wrong credentials error message
3. Empty field validation errors

## Common Error Messages

### Invalid Credentials
```json
{
  "error": {
    "code": "invalid_credentials",
    "message": "Invalid email or password"
  }
}
```

### Validation Errors
```json
{
  "error": {
    "code": "validation_failed",
    "message": "Email is required",
    "param": "email"
  }
}
```

### Weak Password
```json
{
  "error": {
    "code": "weak_password",
    "message": "Password must be at least 8 characters",
    "details": ["Password too short"]
  }
}
```

## Implementation Details

### Files Modified

1. **services/api.ts**
   - `request()` method: Handles both error formats
   - `postFormData()` method: Updated to check `errorData.error?.message` first

2. **services/auth.ts**
   - `login()` method: Already handled both formats
   - `signInWithApple()` method: Updated to check `errorData.error?.message` first

### Backward Compatibility

The frontend maintains backward compatibility by checking for:
1. New format: `errorData.error.message` (priority)
2. Legacy format: `errorData.detail` (fallback)
3. Message field: `errorData.message` (additional fallback)

This ensures the frontend works with both old and new backend versions.
