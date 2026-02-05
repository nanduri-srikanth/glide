# Manual Testing Guide for Feature #1: API Port Configuration

## Implementation Summary

The API port is now configurable via environment variables instead of being hardcoded.

### Changes Made:

1. **services/api.ts** - Updated to use `EXPO_PUBLIC_API_PORT` environment variable
2. **.env.local** - Added `EXPO_PUBLIC_API_PORT=8000`
3. **.env.example** - Created with documentation of all environment variables
4. **docs/API_CONFIGURATION.md** - Comprehensive API configuration documentation
5. **.maestro/api-config-test.yaml** - Maestro test for API configuration
6. **.maestro/login-flow-test.yaml** - Maestro test for login flow

## Verification Steps

### Step 1: Verify Environment Variable Configuration

```bash
# Check that .env.local has the correct configuration
cat .env.local | grep EXPO_PUBLIC_API_PORT

# Expected output:
# EXPO_PUBLIC_API_PORT=8000
```

### Step 2: Verify Code Implementation

```bash
# Check that api.ts uses the environment variable
grep -A 2 "EXPO_PUBLIC_API_PORT" services/api.ts

# Expected output:
# const API_PORT = process.env.EXPO_PUBLIC_API_PORT || '8000';
```

### Step 3: Start the Backend

```bash
# Option A: Use the development script
./start-dev.sh

# Option B: Start manually
cd glide-backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 4: Verify Backend is Running

```bash
# Check health endpoint
curl http://localhost:8000/health

# Expected output: {"status":"ok"} or similar
```

### Step 5: Start the Expo App

```bash
npx expo start
```

Press 'i' to open iOS Simulator or 'a' for Android Emulator.

### Step 6: Check Console Logs

When the app starts, you should see:

```
[API] Base URL: http://localhost:8000/api/v1
```

This confirms the API is configured to use port 8000.

### Step 7: Run Maestro Tests

```bash
# Test API configuration
maestro test .maestro/api-config-test.yaml

# Test login flow
maestro test .maestro/login-flow-test.yaml
```

### Step 8: Manual Login Test

1. Open the app on simulator/emulator
2. Navigate to login screen
3. Enter test credentials:
   - Email: devtest@glide.app
   - Password: test123
4. Tap login
5. Verify successful login (no network errors)

## Expected Results

✅ App connects to backend at http://localhost:8000/api/v1
✅ Login works without "Network Error" or "Connection Failed"
✅ Console shows correct API URL with port 8000
✅ No hardcoded port 8003 in the codebase

## Troubleshooting

### If backend is not accessible:

```bash
# Check if port 8000 is in use
lsof -ti:8000

# Kill any process using port 8000
lsof -ti:8000 | xargs kill -9

# Restart backend
```

### If app shows "Network Error":

1. Verify backend is running: `curl http://localhost:8000/health`
2. Check console logs for the actual API URL
3. Verify .env.local has `EXPO_PUBLIC_API_PORT=8000`
4. Restart the Expo app

### If wrong port is used:

1. Check .env.local configuration
2. Look for hardcoded ports in services/api.ts
3. Restart the app after changing environment variables

## Test Different Ports

To test that the port is truly configurable:

1. Stop the backend
2. Change port in .env.local: `EXPO_PUBLIC_API_PORT=9000`
3. Start backend on port 9000: `uvicorn app.main:app --port 9000`
4. Restart the app
5. Verify console shows: `http://localhost:9000/api/v1`

## Production Override Test

To test production URL override:

1. Add to .env.local: `EXPO_PUBLIC_API_URL=https://api.example.com/api/v1`
2. Build production app
3. Verify app uses the production URL

## Mark Feature as Passing

Once all tests pass:

1. ✅ Environment variable is set correctly
2. ✅ Backend is accessible at configured port
3. ✅ Login flow works end-to-end
4. ✅ Console shows correct API URL
5. ✅ Maestro tests pass

Then mark feature #1 as passing.
