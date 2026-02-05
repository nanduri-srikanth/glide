# API Configuration

## Overview

The Glide app uses environment variables to configure the connection to the backend API server. This allows you to run the backend on any port without modifying code.

## Environment Variables

### Development

- **`EXPO_PUBLIC_API_PORT`** (optional, default: `8000`)
  - Port number where the backend API server is running
  - Used in development builds to construct the API URL
  - Example: `EXPO_PUBLIC_API_PORT=8000`

- **`EXPO_PUBLIC_API_URL`** (optional)
  - Full URL for the API server (production override)
  - If set, this takes precedence over the port-based URL
  - Leave empty for development
  - Example: `EXPO_PUBLIC_API_URL=https://api.production.com/api/v1`

### How It Works

The API configuration is in `services/api.ts`:

```typescript
const API_PORT = process.env.EXPO_PUBLIC_API_PORT || '8000';
const PRODUCTION_API_URL = process.env.EXPO_PUBLIC_API_URL;

export const API_BASE_URL = __DEV__
  ? `http://${getDevHost()}:${API_PORT}/api/v1`  // Development
  : PRODUCTION_API_URL || 'https://your-production-api.com/api/v1';  // Production
```

## Setup

### 1. Create `.env.local` File

Create a `.env.local` file in the project root:

```bash
# API Configuration
EXPO_PUBLIC_API_PORT=8000
```

### 2. Start the Backend

The backend should be running on the configured port:

```bash
# From glide-backend directory
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or use the development script:

```bash
./start-dev.sh
```

### 3. Start the Expo App

```bash
npx expo start
```

The app will automatically connect to `http://localhost:8000/api/v1` (or your configured port).

## Device Testing

When testing on physical devices or emulators, the app automatically detects the correct host:

- **Expo Go**: Uses the debugger host IP
- **Android Emulator**: Uses `10.0.2.2` (localhost alias)
- **iOS Simulator**: Uses `localhost`

You only need to set the port number.

## Verification

To verify the API configuration is working:

1. Check the console logs when the app starts:
   ```
   [API] Base URL: http://localhost:8000/api/v1
   ```

2. Run the Maestro test:
   ```bash
   maestro test .maestro/api-config-test.yaml
   ```

3. Test login flow:
   ```bash
   maestro test .maestro/login-flow-test.yaml
   ```

## Troubleshooting

### "Network Error" or "Connection Failed"

- Verify the backend is running: `curl http://localhost:8000/health`
- Check the port in `.env.local` matches the backend port
- Check console logs for the actual API URL being used

### "404 Not Found" on API Calls

- Verify the API path includes `/api/v1`
- Check that the backend routes are configured correctly

### Port Already in Use

```bash
# Find process using port 8000
lsof -ti:8000

# Kill the process
lsof -ti:8000 | xargs kill -9
```

## Production Deployment

For production builds, set `EXPO_PUBLIC_API_URL` to your production API endpoint:

```bash
EXPO_PUBLIC_API_URL=https://api.yourapp.com/api/v1
```

This will override the port-based URL and use the production endpoint directly.
