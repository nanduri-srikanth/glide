# Cross-Platform Integration Testing Guide

This document provides a manual test checklist to verify both the Swift (iOS) and React Native (Expo) applications work correctly with the same backend data.

## Purpose

Both Glide frontends connect to the same FastAPI backend. This guide ensures data consistency and proper synchronization between:
- **Swift iOS App** (`Glide/Glide/`) - Native iOS app
- **React Native/Expo App** (`/`) - Cross-platform mobile app
- **FastAPI Backend** (`glide-backend/`) - Shared API server

## Prerequisites

### 1. Backend Setup

Start the FastAPI backend server:

```bash
# From the glide-backend directory
cd glide-backend
source .venv/bin/activate  # or venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Verify backend is running:
```bash
curl http://localhost:8000/api/v1/health
```

Expected response:
```json
{"status": "healthy"}
```

### 2. Test User Account

Ensure you have a test user account. If not, register through either app:

**Test User Credentials:**
- Email: `integration@test.com`
- Password: `test12345`
- Full Name: `Integration Tester`

**Or use the existing dev test user:**
- Email: `devtest@glide.app`
- Password: `test123`

### 3. Swift iOS App Setup

1. Open the Swift project in Xcode:
   ```bash
   open Glide/Glide.xcodeproj
   ```

2. Select iOS Simulator (iPhone 15 or later)

3. Build and run (⌘R)

4. Verify the app launches and shows the login screen

### 4. React Native/Expo App Setup

1. Disable auto-login for testing (in `.env.local`):
   ```bash
   EXPO_PUBLIC_DEV_AUTO_LOGIN=false
   ```

2. Start the Expo dev server:
   ```bash
   npx expo start
   ```

3. Press `i` to launch on iOS Simulator

**IMPORTANT:** Use **separate simulators** for each app to run them simultaneously:
- Swift app: iPhone 15 Pro
- Expo app: iPhone 15 Pro Max

---

## Test Cases

### Test 1: Login with Same User in Both Apps

**Purpose:** Verify authentication works consistently across both platforms

**Steps:**

1. **Swift App:**
   - Launch Swift app
   - Enter email: `integration@test.com` (or `devtest@glide.app`)
   - Enter password: `test12345` (or `test123`)
   - Tap "Login"
   - ✅ Verify: Successfully logged in, see notes list screen

2. **React Native App:**
   - Launch Expo app
   - Enter same credentials
   - Tap "Login"
   - ✅ Verify: Successfully logged in, see notes list screen

**Expected Result:** Both apps successfully authenticate the same user

**Common Issues:**
- If login fails in one app, verify backend is running
- Check that API URL is correct in both apps (default: `http://localhost:8000`)
- Verify user exists in database (check backend logs)

---

### Test 2: Create Note in React Native, Verify in Swift

**Purpose:** Verify data created in Expo app appears in Swift app

**Steps:**

1. **React Native App:**
   - Navigate to Notes tab
   - Tap the "+" button to create a new note
   - Enter title: `TEST_RN_001 - Created in Expo`
   - Enter content: `This note was created in React Native to test cross-platform sync`
   - Tap "Save"
   - ✅ Verify: Note appears in notes list

2. **Swift App:**
   - Navigate to Notes screen
   - Pull to refresh (drag down on notes list)
   - ✅ Verify: Note `TEST_RN_001` appears in the notes list
   - Tap on the note
   - ✅ Verify: Title and content match exactly

**Expected Result:** Note created in React Native appears in Swift app after refresh

**Verification Checklist:**
- [ ] Note title matches
- [ ] Note content matches
- [ ] Creation timestamp is consistent
- [ ] Note appears in correct folder (if applicable)

---

### Test 3: Create Note in Swift, Verify in React Native

**Purpose:** Verify data created in Swift app appears in Expo app

**Steps:**

1. **Swift App:**
   - Navigate to Notes screen
   - Tap "+" button to create a new note
   - Enter title: `TEST_SWIFT_001 - Created in Swift`
   - Enter content: `This note was created in Swift to test cross-platform sync`
   - Tap "Save"
   - ✅ Verify: Note appears in notes list

2. **React Native App:**
   - Navigate to Notes tab
   - Pull to refresh (drag down on notes list)
   - ✅ Verify: Note `TEST_SWIFT_001` appears in the notes list
   - Tap on the note
   - ✅ Verify: Title and content match exactly

**Expected Result:** Note created in Swift appears in React Native app after refresh

**Verification Checklist:**
- [ ] Note title matches
- [ ] Note content matches
- [ ] Creation timestamp is consistent
- [ ] Note appears in correct position in list (sorted by date)

---

### Test 4: Edit Note in One App, Verify Changes in Other

**Purpose:** Verify updates propagate correctly between platforms

**Steps:**

1. **Swift App:**
   - Open note `TEST_RN_001` (created in Test 2)
   - Tap "Edit" button
   - Change title to: `TEST_RN_001 - EDITED in Swift`
   - Add to content: `\n\n[Edited from Swift app]`
   - Tap "Save"
   - ✅ Verify: Changes appear in Swift app

2. **React Native App:**
   - Navigate to Notes tab
   - Pull to refresh
   - ✅ Verify: Note title shows updated title `TEST_RN_001 - EDITED in Swift`
   - Tap on the note
   - ✅ Verify: Content includes the new text `[Edited from Swift app]`

**Expected Result:** Edits made in Swift app reflect in React Native app

**Reverse Test (Optional):**
- Edit a different note in React Native
- Verify changes appear in Swift app

**Verification Checklist:**
- [ ] Title changes sync
- [ ] Content changes sync
- [ ] No duplicate notes created
- [ ] Last modified timestamp updates

---

### Test 5: Pin Note in One App, Verify Pinned in Other

**Purpose:** Verify note pinning state syncs between platforms

**Steps:**

1. **React Native App:**
   - Navigate to Notes tab
   - Find note `TEST_SWIFT_001` (created in Test 3)
   - Swipe left on the note or long-press to show context menu
   - Tap "Pin" option
   - ✅ Verify: Note moves to "Pinned" section or shows pin icon
   - ✅ Verify: Pin icon appears next to note title

2. **Swift App:**
   - Navigate to Notes screen
   - Pull to refresh
   - ✅ Verify: Note `TEST_SWIFT_001` shows pin icon (📌)
   - ✅ Verify: Note appears at top of list or in pinned section
   - Tap the pin icon to unpin
   - ✅ Verify: Pin icon disappears

3. **React Native App:**
   - Pull to refresh
   - ✅ Verify: Note no longer shows pin icon
   - ✅ Verify: Note moved out of pinned section

**Expected Result:** Pin/unpin state syncs bidirectionally between apps

**Verification Checklist:**
- [ ] Pin action in one app reflects in other
- [ ] Unpin action in one app reflects in other
- [ ] Pinned notes appear at top of list in both apps
- [ ] Pin icon displays consistently

---

### Test 6: Create Folder in React Native, Verify in Swift

**Purpose:** Verify folder structure syncs between platforms

**Steps:**

1. **React Native App:**
   - Navigate to Notes tab
   - Tap "Folders" or sidebar icon
   - Tap "Create Folder" or "+" button
   - Enter folder name: `TEST_FOLDER_RN`
   - Tap "Create" or "Save"
   - ✅ Verify: Folder appears in folder list

2. **Swift App:**
   - Navigate to Notes screen
   - Tap "Folders" button or open sidebar
   - ✅ Verify: Folder `TEST_FOLDER_RN` appears in folder list
   - Tap on the folder
   - ✅ Verify: Folder opens (even though it's empty)

3. **Test Moving Note to Folder:**
   - In React Native, move note `TEST_RN_001` to `TEST_FOLDER_RN`
   - In Swift app, refresh and verify note appears in that folder
   - ✅ Verify: Note appears in correct folder in both apps

**Expected Result:** Folders created in React Native appear in Swift app

**Verification Checklist:**
- [ ] Folder name matches
- [ ] Folder hierarchy is correct
- [ ] Notes in folder sync correctly
- [ ] Folder can be renamed/deleted from either app

---

### Test 7: Logout in Swift Clears Session, Requires Re-Login

**Purpose:** Verify authentication state is managed correctly

**Steps:**

1. **Swift App:**
   - Ensure you're logged in
   - Navigate to Settings or profile tab
   - Tap "Logout" button
   - ✅ Verify: Logged out successfully
   - ✅ Verify: Login screen appears
   - Close the app (swipe up from app switcher)

2. **Swift App:**
   - Relaunch the Swift app
   - ✅ Verify: Login screen appears (not auto-logged in)
   - ✅ Verify: No data is visible without authentication

3. **React Native App:**
   - Navigate to Settings or profile tab
   - Tap "Logout" button
   - ✅ Verify: Logged out successfully
   - ✅ Verify: Login screen appears
   - Close and relaunch the app
   - ✅ Verify: Login screen appears (not auto-logged in)

**Expected Result:** Logout properly clears authentication in both apps

**Verification Checklist:**
- [ ] Logout removes auth token
- [ ] App requires re-login after logout
- [ ] No data accessible without authentication
- [ ] Login works again after logout

**Security Test (Optional):**
- After logout in Swift, try accessing API endpoints directly
- Verify 401 Unauthorized responses

---

## Additional Tests (Optional)

### Test 8: Delete Note Sync

1. Delete a note in React Native
2. Verify it's deleted in Swift (after refresh)
3. Reverse: Delete in Swift, verify in React Native

### Test 9: Voice Recording Sync

1. Create voice note in Swift app
2. Verify audio file and transcription appear in React Native

### Test 10: Actions/Reminders Sync

1. Create a note with action items in one app
2. Verify actions sync to the other app
3. Mark action as complete, verify syncs

---

## Troubleshooting

### Backend Not Running

**Issue:** Both apps show "Connection refused" or network errors

**Solution:**
```bash
cd glide-backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Verify with: `curl http://localhost:8000/api/v1/health`

### Data Not Appearing

**Issue:** Changes in one app don't appear in the other

**Solutions:**
1. **Pull to refresh** in the second app
2. Check both apps are using the same API URL
3. Verify both apps logged in as the same user (check email in settings)
4. Check backend logs for errors:
   ```bash
   # In backend terminal
   # Look for 200 OK responses
   ```

### Authentication Errors

**Issue:** 401 Unauthorized or "Invalid credentials"

**Solutions:**
1. Verify user exists in database
2. Check password is correct
3. Ensure both apps using same API endpoint
4. Try logging out and logging back in

### Simulator Port Conflicts

**Issue:** Both apps trying to use same simulator

**Solution:**
- Run Swift app on iPhone 15 Pro
- Run Expo app on iPhone 15 Pro Max
- Or use physical device for one app

### API URL Mismatch

**Issue:** Apps pointing to different backend instances

**Verify:**
- Swift app: Check `Config.swift` for `apiBaseUrl`
- Expo app: Check `.env.local` for `EXPO_PUBLIC_API_URL`
- Both should point to same backend (e.g., `http://localhost:8000`)

---

## Success Criteria

All tests passing means:
- ✅ Both apps authenticate with same credentials
- ✅ Data created in one app appears in the other
- ✅ Edits sync bidirectionally
- ✅ Pin/unpin state syncs
- ✅ Folders sync correctly
- ✅ Logout clears session properly
- ✅ No data corruption or duplication
- ✅ API returns consistent responses to both apps

---

## Test Log Template

Use this template to track test results:

```
Date: ____________________
Tester: ____________________
Backend URL: _________________
Test User: ___________________

Test 1 - Login Same User:          [ ] PASS  [ ] FAIL
Test 2 - RN Create → Swift Verify: [ ] PASS  [ ] FAIL
Test 3 - Swift Create → RN Verify: [ ] PASS  [ ] FAIL
Test 4 - Edit Sync:                [ ] PASS  [ ] FAIL
Test 5 - Pin Sync:                 [ ] PASS  [ ] FAIL
Test 6 - Folder Sync:              [ ] PASS  [ ] FAIL
Test 7 - Logout Session:           [ ] PASS  [ ] FAIL

Notes:
_______________________________________________________
_______________________________________________________
_______________________________________________________
```

---

## Automated Testing (Future)

Consider adding automated integration tests:

1. **Maestro Tests** (for React Native):
   - `.maestro/cross-platform-test.yaml`
   - Automate RN app actions

2. **XCUITest** (for Swift):
   - UI tests for Swift app
   - Verify data syncs correctly

3. **Backend API Tests**:
   - Simulate requests from both clients
   - Verify consistent responses

---

## Related Documentation

- **Swift App**: `Glide/Glide/README.md`
- **React Native App**: `README.md` (root directory)
- **Backend API**: `glide-backend/README.md`
- **API Documentation**: `http://localhost:8000/docs` (Swagger UI)

---

## Quick Reference

### Backend Endpoints Used

```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/notes
POST   /api/v1/notes
PUT    /api/v1/notes/{id}
PATCH  /api/v1/notes/{id}/pin
DELETE /api/v1/notes/{id}
GET    /api/v1/folders
POST   /api/v1/folders
```

### App File Locations

- **Swift Notes List**: `Glide/Glide/Views/NotesListView.swift`
- **Expo Notes List**: `app/(tabs)/notes.tsx`
- **Swift API Service**: `Glide/Glide/Services/APIService.swift`
- **Expo API Service**: `services/api.ts`

---

**Last Updated:** 2026-02-05
**Feature:** #21 - Cross-Platform Data Validation
**Status:** Ready for Testing
