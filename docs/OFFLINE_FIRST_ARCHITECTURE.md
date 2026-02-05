# Offline-First Architecture Research & Implementation Plan

> **Goal**: Build a local-first notes app that works offline, syncs across devices (iPhone, iPad, Mac), and provides real-time updates when online.

---

## Executive Summary

After researching the available options, **PowerSync + Supabase** is the recommended solution for Glide's offline-first architecture. It provides:

- ✅ Local SQLite database (always available, instant reads)
- ✅ Automatic bi-directional sync with Supabase Postgres
- ✅ Offline queue with automatic retry
- ✅ Real-time sync when online
- ✅ Multi-device support (same architecture scales to Mac, iPad, iPhone)
- ✅ Foundation for future collaborative editing

---

## Research Sources

### Official Documentation
- [PowerSync + Supabase Integration Guide](https://docs.powersync.com/integration-guides/supabase-+-powersync)
- [PowerSync React Native SDK](https://docs.powersync.com/client-sdk-references/react-native)
- [Supabase + PowerSync Partner Page](https://supabase.com/partners/integrations/powersync)

### Implementation Examples
- [Ignite Cookbook: LocalFirstDataWithPowerSync](https://ignitecookbook.com/docs/recipes/LocalFirstDataWithPowerSync/)
- [React Native Supabase Group Chat Demo](https://github.com/powersync-ja/powersync-js/blob/main/demos/react-native-supabase-group-chat/README.md)
- [PowerSync Demo Apps Gallery](https://docs.powersync.com/resources/demo-apps-example-projects)

### Case Studies
- [trakkd Case Study](https://www.powersync.com/blog/developer-case-study-timo-behrens-trakkd) - Collaborative meeting notes app (similar use case to Glide)

### Comparisons
- [React Native Local Database Options](https://www.powersync.com/blog/react-native-local-database-options)
- [Supabase Offline Discussion](https://github.com/orgs/supabase/discussions/357)

---

## Options Comparison

| Criteria | PowerSync | WatermelonDB | ElectricSQL | Custom (SQLite + Sync) |
|----------|-----------|--------------|-------------|------------------------|
| **Offline Support** | ✅ First-class | ✅ First-class | ⚠️ Limited | ✅ Manual |
| **Supabase Integration** | ✅ Native | ⚠️ Manual sync | ✅ Native | ⚠️ Manual |
| **Sync Complexity** | Low (managed) | High (DIY) | Medium | Very High |
| **Schema Migrations** | Handled server-side | Manual client-side | Handled | Manual both |
| **React Native** | ✅ SDK available | ✅ SDK available | ⚠️ Web-focused | ✅ expo-sqlite |
| **Conflict Resolution** | ✅ Server-side | ⚠️ Last-write-wins | ✅ CRDTs | Manual |
| **Production Ready** | ✅ 10+ years (JourneyApps) | ✅ Mature | ⚠️ Newer | Depends |
| **Multi-device Sync** | ✅ Built-in | Manual | ✅ Built-in | Manual |
| **Pricing** | Free tier + usage-based | Free (OSS) | Free (OSS) | Free |

### Why PowerSync Wins

1. **Production Heritage**: Spun off from JourneyApps Platform, in production for 10+ years
2. **Supabase Native**: Purpose-built integration, no custom sync logic needed
3. **Schema Simplicity**: Schemaless on client, no client-side migrations
4. **Offline-First Focus**: Unlike ElectricSQL which is "local-first" but not "offline-first"
5. **Case Study Match**: trakkd (collaborative meeting notes) is nearly identical to our use case

---

## PowerSync Pricing

| Plan | Cost | Limits | Use Case |
|------|------|--------|----------|
| **Free** | $0 | Deactivates after 1 week inactivity | Development |
| **Pro** | ~$50/month | 5,000 DAU | Early production |
| **Pro (scaled)** | ~$400/month | 100,000 DAU | Growth |
| **Self-hosted** | Free (OSS) | Unlimited | Full control |

*Source: [PowerSync Pricing](https://www.powersync.com/pricing)*

**Recommendation**: Start with Pro plan (~$50/month), consider self-hosted later for cost optimization.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Mobile App                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│   │    Screens   │───►│    Hooks     │───►│  PowerSync   │     │
│   │  (UI Layer)  │    │ (useQuery)   │    │   Context    │     │
│   └──────────────┘    └──────────────┘    └──────┬───────┘     │
│                                                   │              │
│                                          ┌────────▼────────┐    │
│                                          │  Local SQLite   │    │
│                                          │  (expo-sqlite)  │    │
│                                          └────────┬────────┘    │
│                                                   │              │
│   ┌───────────────────────────────────────────────┼──────────┐  │
│   │                  PowerSync SDK                │          │  │
│   ├───────────────────────────────────────────────┼──────────┤  │
│   │                                               │          │  │
│   │  ┌─────────────────┐    ┌─────────────────────▼───────┐  │  │
│   │  │  Upload Queue   │    │   Sync Stream (Realtime)    │  │  │
│   │  │  (Offline Ops)  │    │   (WAL-based replication)   │  │  │
│   │  └────────┬────────┘    └─────────────────────┬───────┘  │  │
│   │           │                                   │          │  │
│   └───────────┼───────────────────────────────────┼──────────┘  │
│               │                                   │              │
└───────────────┼───────────────────────────────────┼──────────────┘
                │                                   │
                │           INTERNET                │
                ▼                                   ▼
┌───────────────────────────────────────────────────────────────────┐
│                        PowerSync Service                          │
│              (Manages sync, handles connections)                  │
└───────────────────────────────────┬───────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                          Supabase                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │  Postgres   │  │    Auth     │  │   Storage   │               │
│  │  (Notes,    │  │  (Users,    │  │  (Audio     │               │
│  │   Folders)  │  │   Sessions) │  │   files)    │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
└───────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Reading Data (Always Local)

```
User taps folder → useQuery("SELECT * FROM notes WHERE folder_id = ?")
                          │
                          ▼
                   Local SQLite
                   (instant, <10ms)
                          │
                          ▼
                   UI renders immediately
```

### Writing Data (Local-First)

```
User creates note → INSERT INTO local SQLite
                           │
                           ├──► UI updates instantly
                           │
                           ▼
                    Upload Queue
                           │
           ┌───────────────┴───────────────┐
           │                               │
      [ONLINE]                        [OFFLINE]
           │                               │
           ▼                               ▼
    Push to Supabase              Queue persisted
           │                      (retry when online)
           ▼
    PowerSync broadcasts
    to other devices
```

### Syncing (Background)

```
PowerSync Service monitors Postgres WAL
           │
           ▼
    Detects change (INSERT/UPDATE/DELETE)
           │
           ▼
    Pushes to all connected devices
           │
           ▼
    Local SQLite updated
           │
           ▼
    useQuery auto-refreshes UI
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal**: Set up PowerSync infrastructure without breaking existing app

#### 1.1 Install Dependencies
```bash
npx expo install @powersync/react-native @journeyapps/react-native-quick-sqlite
```

#### 1.2 Update Metro Config
```javascript
// metro.config.js
config.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: {
      blockList: {
        [require.resolve("@powersync/react-native")]: true,
      },
    },
  },
})
```

#### 1.3 Create PowerSync Schema
```typescript
// lib/powersync/schema.ts
import { column, Schema, TableV2 } from '@powersync/react-native';

const notes = new TableV2({
  title: column.text,
  transcript: column.text,
  summary: column.text,
  duration: column.integer,
  folder_id: column.text,
  tags: column.text, // JSON string
  is_pinned: column.integer,
  is_archived: column.integer,
  ai_processed: column.integer,
  ai_metadata: column.text, // JSON string
  audio_url: column.text,
  created_at: column.text,
  updated_at: column.text,
  user_id: column.text,
}, { indexes: { folder: ['folder_id'], user: ['user_id'] } });

const folders = new TableV2({
  name: column.text,
  icon: column.text,
  color: column.text,
  is_system: column.integer,
  sort_order: column.integer,
  parent_id: column.text,
  depth: column.integer,
  user_id: column.text,
  created_at: column.text,
}, { indexes: { user: ['user_id'] } });

const actions = new TableV2({
  note_id: column.text,
  action_type: column.text,
  status: column.text,
  priority: column.text,
  title: column.text,
  description: column.text,
  scheduled_date: column.text,
  user_id: column.text,
  // ... other fields
});

export const AppSchema = new Schema({ notes, folders, actions });
```

#### 1.4 Create Supabase Connector
```typescript
// lib/powersync/connector.ts
import { supabase } from '@/lib/supabase';

export const supabaseConnector = {
  async fetchCredentials() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    return {
      endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL,
      token: session.access_token,
      expiresAt: new Date(session.expires_at! * 1000),
    };
  },

  async uploadData(database) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    for (const op of transaction.crud) {
      const table = supabase.from(op.table);

      switch (op.op) {
        case 'PUT':
          await table.upsert({ ...op.opData, id: op.id });
          break;
        case 'PATCH':
          await table.update(op.opData).eq('id', op.id);
          break;
        case 'DELETE':
          await table.delete().eq('id', op.id);
          break;
      }
    }
    await transaction.complete();
  },
};
```

#### 1.5 Set up PowerSync Dashboard
1. Create PowerSync Cloud account
2. Add Supabase database connection
3. Configure sync rules (see below)

#### 1.6 Configure Sync Rules
```yaml
# PowerSync Dashboard > Sync Rules
bucket_definitions:
  user_data:
    parameters: SELECT request.user_id() as user_id
    data:
      - SELECT * FROM notes WHERE user_id = bucket.user_id
      - SELECT * FROM folders WHERE user_id = bucket.user_id
      - SELECT * FROM actions WHERE user_id = bucket.user_id
```

---

### Phase 2: Migration (Week 2)

**Goal**: Replace TanStack Query reads with PowerSync queries

#### 2.1 Create PowerSync Hooks
```typescript
// hooks/powersync/useNotes.ts
import { useQuery } from '@powersync/react-native';

export function useNotes(folderId?: string) {
  const query = folderId
    ? 'SELECT * FROM notes WHERE folder_id = ? ORDER BY created_at DESC'
    : 'SELECT * FROM notes ORDER BY created_at DESC';

  const params = folderId ? [folderId] : [];

  return useQuery(query, params);
}

export function useNote(noteId: string) {
  return useQuery(
    'SELECT * FROM notes WHERE id = ?',
    [noteId]
  );
}

export function useFolders() {
  return useQuery(
    'SELECT * FROM folders ORDER BY sort_order ASC'
  );
}
```

#### 2.2 Create Write Functions
```typescript
// hooks/powersync/useNoteMutations.ts
import { usePowerSync } from '@powersync/react-native';
import { v4 as uuid } from 'uuid';

export function useNoteMutations() {
  const db = usePowerSync();

  const createNote = async (data: CreateNoteData) => {
    const id = uuid();
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO notes (id, title, transcript, folder_id, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.title, data.transcript, data.folderId, data.userId, now, now]
    );

    return id;
  };

  const updateNote = async (id: string, data: Partial<NoteData>) => {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), new Date().toISOString(), id];

    await db.execute(
      `UPDATE notes SET ${sets}, updated_at = ? WHERE id = ?`,
      values
    );
  };

  const deleteNote = async (id: string) => {
    await db.execute('DELETE FROM notes WHERE id = ?', [id]);
  };

  return { createNote, updateNote, deleteNote };
}
```

#### 2.3 Update NotesContext
```typescript
// context/NotesContext.tsx (simplified)
import { useNotes, useFolders } from '@/hooks/powersync';

export function NotesProvider({ children }) {
  const { data: notes, isLoading: notesLoading } = useNotes(selectedFolderId);
  const { data: folders, isLoading: foldersLoading } = useFolders();

  // All reads are now instant from local SQLite
  // Writes auto-sync in background

  return (
    <NotesContext.Provider value={{ notes, folders, ... }}>
      {children}
    </NotesContext.Provider>
  );
}
```

---

### Phase 3: Voice Recording Offline (Week 3)

**Goal**: Enable full offline voice recording with queued transcription

#### 3.1 Local Audio Storage
```typescript
// services/offlineAudio.ts
import * as FileSystem from 'expo-file-system';

const AUDIO_DIR = `${FileSystem.documentDirectory}audio/`;

export async function saveAudioLocally(uri: string, noteId: string) {
  await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
  const localPath = `${AUDIO_DIR}${noteId}.m4a`;
  await FileSystem.copyAsync({ from: uri, to: localPath });
  return localPath;
}
```

#### 3.2 Transcription Queue
```typescript
// Queue transcription jobs for when online
const transcriptionQueue = new TableV2({
  note_id: column.text,
  local_audio_path: column.text,
  status: column.text, // pending, processing, completed, failed
  created_at: column.text,
});
```

---

### Phase 4: Polish & Testing (Week 4)

- [ ] Conflict resolution edge cases
- [ ] Offline indicator UI
- [ ] Sync status indicators
- [ ] Error handling & retry UI
- [ ] Performance testing with large datasets
- [ ] Multi-device testing (iPhone + iPad)

---

## Migration Checklist

### Backend (Supabase)
- [ ] Create PowerSync replication user with SELECT permissions
- [ ] Create publication for notes, folders, actions tables
- [ ] Verify RLS policies work with PowerSync

### PowerSync Dashboard
- [ ] Create PowerSync Cloud project
- [ ] Connect to Supabase database
- [ ] Configure Supabase Auth integration
- [ ] Define sync rules for user data isolation
- [ ] Test sync in dashboard

### Frontend
- [ ] Install PowerSync SDK
- [ ] Update Metro config for inline requires
- [ ] Create PowerSync schema matching Supabase tables
- [ ] Create Supabase connector (auth + upload)
- [ ] Create DatabaseProvider context
- [ ] Replace TanStack Query hooks with PowerSync useQuery
- [ ] Update mutation functions to use PowerSync execute
- [ ] Add offline audio storage
- [ ] Add transcription queue for offline recordings
- [ ] Add sync status indicators
- [ ] Test offline scenarios

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| PowerSync service outage | Low | High | Data is local-first, app works offline |
| Schema migration complexity | Medium | Medium | Keep schema simple, use JSON for flexible fields |
| Conflict resolution edge cases | Medium | Low | Last-write-wins for notes (acceptable for single-user) |
| Learning curve | Medium | Low | Good docs, demo apps available |
| Cost scaling | Low | Medium | Can self-host if needed |

---

## Success Metrics

1. **Offline functionality**: App fully usable without internet
2. **Sync latency**: <1 second for changes to appear on other devices
3. **Folder switching**: Instant (<50ms) regardless of network state
4. **Data integrity**: Zero data loss during offline→online transitions
5. **Battery impact**: Minimal background sync overhead

---

## References

- [PowerSync Documentation](https://docs.powersync.com/)
- [PowerSync + Supabase Guide](https://docs.powersync.com/integration-guides/supabase-+-powersync)
- [React Native SDK Reference](https://docs.powersync.com/client-sdk-references/react-native)
- [Ignite Cookbook Recipe](https://ignitecookbook.com/docs/recipes/LocalFirstDataWithPowerSync/)
- [trakkd Case Study](https://www.powersync.com/blog/developer-case-study-timo-behrens-trakkd)
- [Demo Apps](https://docs.powersync.com/resources/demo-apps-example-projects)
