# Offline-First Architecture: Complete Implementation Plan

## Core Principles

1. **Local DB is the single source of truth for UI** - All reads come from local DB
2. **Write-through to local first** - All writes hit local DB, then sync to server
3. **Server is authoritative for sync** - Conflicts resolved with server-wins
4. **Seamless online/offline** - User doesn't need to think about connectivity

---

## Current State (Broken)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│     UI      │────▶│  Local DB   │     │   Server    │
│  (reads)    │     │  (empty!)   │     │  (has data) │
└─────────────┘     └─────────────┘     └─────────────┘
                           ▲                    │
                           └────── X ───────────┘
                              (no bridge)
```

**Problems:**
1. UI reads from empty local DB
2. Note creation goes to server but response not stored locally
3. Hydration never triggers (chicken-and-egg in sync effect)
4. No write-through caching

---

## Target State

```
┌─────────────────────────────────────────────────────────┐
│                         UI Layer                         │
│   Always reads from Local DB • Shows sync status         │
└────────────────────────┬────────────────────────────────┘
                         │ reads
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      Local SQLite DB                     │
│   Notes • Folders • Actions • Sync Queue • Audio Queue  │
└────────────────────────┬────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │    Sync Engine      │
              │  (bidirectional)    │
              └──────────┬──────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase Server                       │
│            Source of truth for sync conflicts            │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flows

### Flow 1: First Launch / Login
```
1. User logs in
2. Trigger HYDRATION:
   - Fetch all folders from server → store in local DB
   - Fetch all notes from server → store in local DB
   - Fetch all actions from server → store in local DB
3. Mark hydration complete
4. UI reads from now-populated local DB
```

### Flow 2: Create Note (Online)
```
1. User creates note (recording/text)
2. Call server API to create note
3. Server returns note with ID
4. Store note in local DB with:
   - serverId = server's ID
   - syncStatus = 'synced'
5. UI reads from local DB → shows note immediately
```

### Flow 3: Create Note (Offline)
```
1. User creates note (recording/text)
2. Store in local DB with:
   - id = local UUID
   - serverId = null
   - syncStatus = 'pending'
3. Queue audio for upload (if applicable)
4. UI reads from local DB → shows note immediately
5. When online:
   - Push note to server
   - Update serverId and syncStatus
   - Upload audio if queued
```

### Flow 4: Edit Note
```
1. User edits note
2. Update local DB immediately
3. Set syncStatus = 'pending'
4. If online: push to server immediately
5. If offline: queue for later sync
```

### Flow 5: Fetch/Refresh Notes
```
1. UI requests notes
2. Return notes from local DB immediately (fast!)
3. If online: fetch from server in background
4. Merge server data into local DB
5. UI automatically updates (React state)
```

### Flow 6: Background Sync
```
Triggered on:
- App foreground
- Network reconnect
- Manual pull-to-refresh
- Periodic timer (optional)

Steps:
1. PUSH: Send all pending local changes to server
2. PULL: Fetch server changes since lastSyncAt
3. MERGE: Update local DB with server data
4. Update lastSyncAt timestamp
```

---

## Implementation Tasks

### Phase 1: Fix Hydration (Critical)

**File: `context/SyncContext.tsx`**

Problem: Sync only triggers when `isHydrated` is true, but starts false.

```typescript
// CURRENT (broken):
useEffect(() => {
  if (isOnline && isInitialized && isHydrated) {
    sync(); // Never runs on first launch!
  }
}, [isOnline, isInitialized, isHydrated]);

// FIX:
useEffect(() => {
  if (isOnline && isInitialized) {
    if (!isHydrated) {
      // First launch - do initial hydration
      hydrate();
    } else {
      // Already hydrated - do incremental sync
      sync();
    }
  }
}, [isOnline, isInitialized, isHydrated]);
```

### Phase 2: Write-Through Caching

**Principle:** Every successful server response must be stored in local DB.

**Files to update:**

1. **`hooks/useRecording.ts`**
   - After `voiceService.synthesizeNote()` succeeds, store note in local DB
   - After `voiceService.processVoiceMemo()` succeeds, store note in local DB

2. **`hooks/useNoteDetail.ts`**
   - After fetching note detail, store in local DB
   - After updating note, store updated version in local DB
   - After deleting note, mark as deleted in local DB

3. **`context/NotesContext.tsx`**
   - After `fetchNotes()` from server, store all notes in local DB
   - After `fetchFolders()` from server, store all folders in local DB

4. **`services/voice.ts`** (or wrapper)
   - Create wrapper functions that handle local DB storage

### Phase 3: Proper Sync Engine

**File: `services/sync/SyncEngine.ts`**

```typescript
class SyncEngine {
  // Initial hydration - fetch everything from server
  async hydrate(): Promise<void> {
    // 1. Fetch all folders
    // 2. Fetch all notes (paginated)
    // 3. Fetch all actions
    // 4. Store everything in local DB with syncStatus: 'synced'
    // 5. Set lastSyncAt
    // 6. Mark hydrated = true
  }

  // Incremental sync - only changes since last sync
  async sync(): Promise<SyncResult> {
    // 1. PUSH: Get all pending local changes, send to server
    // 2. PULL: Fetch server changes since lastSyncAt
    // 3. MERGE: Update local DB
    // 4. Update lastSyncAt
  }

  // Push a single entity immediately (for online writes)
  async pushNote(localNote: LocalNote): Promise<void> {
    // Send to server, update local record with serverId
  }
}
```

### Phase 4: Update NotesContext for Local-First Reads

**File: `context/NotesContext.tsx`**

```typescript
// All reads come from local DB
const fetchNotes = useCallback(async (folderId?: string) => {
  // 1. Read from local DB immediately
  const localNotes = await notesRepository.getAllNotes(folderId);
  setNotes(localNotes.map(toNoteListItem));

  // 2. If online, trigger background sync (don't await)
  if (isOnline) {
    syncInBackground();
  }
}, [isOnline]);

// All writes go to local DB first
const createNote = useCallback(async (input) => {
  // 1. Create in local DB
  const localNote = await notesRepository.createNote(input);

  // 2. Update UI immediately
  setNotes(prev => [toNoteListItem(localNote), ...prev]);

  // 3. If online, push to server
  if (isOnline) {
    await syncEngine.pushNote(localNote);
  }

  return localNote;
}, [isOnline]);
```

### Phase 5: Update Recording Flow

**File: `hooks/useRecording.ts`**

```typescript
const synthesizeNote = useCallback(async (textInput, folderId) => {
  if (isOnline) {
    // Online: Create on server, store locally
    const result = await voiceService.synthesizeNote({...});
    if (result.data) {
      // Store in local DB
      await notesRepository.upsertFromServer({
        id: result.data.note_id,
        title: result.data.title,
        transcript: result.data.narrative,
        // ... other fields
      });
    }
    return result;
  } else {
    // Offline: Create locally, queue for sync
    return saveRecordingLocally(folderId, textInput);
  }
}, [isOnline]);
```

### Phase 6: Update Note Detail Hook

**File: `hooks/useNoteDetail.ts`**

```typescript
// Fetch note - local first, then server
const fetchNote = useCallback(async (noteId: string) => {
  // 1. Try local DB first
  let note = await notesRepository.getNoteById(noteId);
  if (note) {
    setRawNote(toNoteDetail(note));
  }

  // 2. If online, fetch fresh from server
  if (isOnline) {
    const result = await notesService.getNote(noteId);
    if (result.data) {
      // Update local DB
      await notesRepository.upsertFromServer(result.data);
      // Update UI
      setRawNote(result.data);
    }
  }
}, [isOnline]);
```

---

## File Change Summary

| File | Changes |
|------|---------|
| `context/SyncContext.tsx` | Fix hydration trigger, add hydrate() call |
| `context/NotesContext.tsx` | All reads from local DB, write-through caching |
| `hooks/useRecording.ts` | Store server responses in local DB |
| `hooks/useNoteDetail.ts` | Local-first fetch, write-through on updates |
| `services/sync/SyncEngine.ts` | Improve hydrate(), add pushNote() |
| `services/repositories/*.ts` | Add upsertFromServer helpers |

---

## Sync Status UI

Show users what's happening:

```
┌─────────────────────────────────────────┐
│ ✓ All changes saved                     │  (everything synced)
│ ↑ Syncing 3 changes...                  │  (push in progress)
│ ⚠ 5 changes pending • Offline           │  (offline with pending)
│ ↻ Refreshing...                         │  (pull in progress)
└─────────────────────────────────────────┘
```

---

## Testing Checklist

1. **Fresh install (online)**: Hydration pulls all data, UI shows notes
2. **Create note (online)**: Note appears immediately, syncs to server
3. **Create note (offline)**: Note appears immediately, syncs when online
4. **Edit note (online)**: Changes save immediately
5. **Edit note (offline)**: Changes save locally, sync when online
6. **Kill app with pending changes**: Changes persist, sync on next launch
7. **Login on new device**: All synced data appears

---

## Order of Implementation

1. **Fix hydration trigger** - Most critical, unblocks everything
2. **Write-through in useRecording** - Notes appear after creation
3. **Write-through in NotesContext** - Refresh populates local DB
4. **Write-through in useNoteDetail** - Note details cached
5. **Sync status UI** - User visibility
6. **Offline creation flow** - Full offline support
7. **Background sync** - Continuous freshness

---

## Questions to Resolve

1. **Conflict resolution**: What if same note edited on two devices?
   - Current plan: Server wins, local backup created

2. **Audio handling**: Keep audio locally or delete after upload?
   - Current plan: Delete after successful transcription (save space)

3. **Sync frequency**: How often to background sync?
   - Current plan: On foreground + on reconnect (no timer)

4. **Error handling**: What if sync fails repeatedly?
   - Current plan: Retry with backoff, show error to user after N failures
