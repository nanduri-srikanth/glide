# Glide Development Context

## Project Overview
Glide is a voice-first note-taking app that transcribes, synthesizes, and extracts actionable items (calendar events, reminders, emails) from voice memos.

## Current Tech Stack
- **Frontend:** Expo/React Native 0.81, TypeScript
- **Backend:** FastAPI (Python, async)
- **Database:** PostgreSQL via Supabase
- **LLM:** Groq (llama-3.3-70b-versatile)
- **Transcription:** Groq Whisper v3
- **Storage:** S3/Supabase Storage
- **Integrations:** Google Calendar/Gmail, Apple CalDAV/Reminders

---

## MVP Roadmap: 5 Pillars

### 1. Execution Basics (Reminders & Calendar)
**Status: 70% — Backend ready, frontend broken**

What works:
- Backend models for Calendar, Email, Reminder actions
- Google Calendar integration via OAuth
- Apple Calendar/Reminders via CalDAV
- Gmail draft creation
- Action execution endpoint (POST /actions/{id}/execute)
- LLM extraction of actions from transcripts

What's broken:
- `saveToServer()` in `useActionDrafts.ts` is STUBBED — user edits never persist
- No `POST /actions` endpoint for user-created actions
- Draft storage is in-memory only
- No local device reminders (requires expo-notifications)
- No push notifications when reminders are due

**TODO:**
- [ ] Implement `POST /api/v1/actions` endpoint for creating new actions
- [ ] Wire up `saveToServer()` in frontend to call the endpoint
- [ ] Add `expo-notifications` for local reminders
- [ ] Add `expo-task-manager` for background sync
- [ ] Implement notification scheduling when reminders are created

---

### 2. Persistent Context (Entity Extraction)
**Status: 0% — Does not exist**

Current reality:
- Each note processed in complete isolation
- No Person, Project, or Place models
- No knowledge graph, no frequency tracking
- "John" in Note 1 and "John Smith" in Note 15 are unrelated

**TODO:**
- [ ] Create Entity model (type: person/project/place/thing)
- [ ] Create EntityMention model (links entities to notes with context)
- [ ] Add entity extraction to LLM pipeline
- [ ] Implement entity deduplication/merging logic
- [ ] Add entity frequency tracking
- [ ] Create `/api/v1/entities` endpoints
- [ ] Enable pgvector extension in Supabase
- [ ] Create embeddings table for semantic matching

---

### 3. Daily Touchpoint
**Status: 0% — Blank canvas**

Nothing exists:
- No morning summary or evening review
- No push notification infrastructure
- No widgets
- No streak/habit tracking

**TODO:**
- [ ] Add notification preferences to User model (preferred time, enabled/disabled)
- [ ] Create `/api/v1/digests/{date}` endpoint
- [ ] Implement daily digest generation with LLM
- [ ] Set up pg_cron in Supabase for scheduled jobs
- [ ] Implement Expo Push notification service
- [ ] Add `expo-notifications` to frontend
- [ ] Create Daily Summary screen in app
- [ ] Add streak tracking model and UI

---

### 4. Retrieval Interface
**Status: 15% — Keyword search only**

What exists:
- Basic ILIKE search against titles/transcripts/tags
- `/notes?q=...` and `/notes/search?q=...` endpoints

What's missing:
- No semantic/vector search
- No RAG pipeline
- No voice query capability
- No conversational interface

**TODO:**
- [ ] Enable pgvector extension in Supabase
- [ ] Add embeddings column to notes table (or separate table)
- [ ] Generate embeddings on note save (OpenAI text-embedding-3-small)
- [ ] Create `/api/v1/search/semantic` endpoint
- [ ] Build RAG pipeline: retrieve relevant chunks → synthesize with Groq
- [ ] Add voice query mode to frontend (Whisper → search → response)
- [ ] Create conversational retrieval UI

---

### 5. Proactive Surfacing
**Status: 0% — Not implemented**

Current state:
- No cross-note analysis
- No pattern detection
- No analytics service

**TODO:**
- [ ] Create analytics queries for pattern detection (repeated mentions, stale actions)
- [ ] Add `/api/v1/insights` endpoint
- [ ] Implement "mentioned X times without completing" detection
- [ ] Create notification triggers for insights
- [ ] Build insights UI component
- [ ] Add proactive notification scheduling

---

## Packages to Add

### Frontend (npm)
```
expo-notifications     # Local + push notifications
expo-task-manager      # Background task execution
expo-background-fetch  # Periodic background sync
```

### Backend (pip)
```
# Already have what's needed, but consider:
apscheduler           # If not using pg_cron
```

### Supabase Extensions
```
pgvector              # Vector similarity search
pg_cron               # Scheduled jobs (already available)
```

### External Services
```
OpenAI Embeddings API  # text-embedding-3-small for vectors
Expo Push Service      # Free push notifications
```

---

## Key Files Reference

### Frontend
- `services/api.ts` — API client
- `hooks/useActionDrafts.ts` — Action editing (saveToServer is stubbed!)
- `context/AuthContext.tsx` — Authentication state
- `app/(tabs)/` — Main tab screens

### Backend
- `app/main.py` — FastAPI app entry
- `app/routers/` — API endpoints
- `app/services/llm.py` — LLM integration (Groq)
- `app/services/transcription.py` — Whisper transcription
- `app/models/` — SQLAlchemy models
- `app/database.py` — DB connection

---

## Architecture Gaps Summary

1. **No entity layer** — people/projects/places don't exist as concepts
2. **No cross-note intelligence** — everything is note-scoped
3. **No notification infrastructure** — no scheduled jobs, no push
4. **Frontend→Backend action pipeline broken** — saveToServer() is stubbed
5. **No embeddings/vector search** — retrieval is keyword-only

---

## Effort Estimates by Pillar

| Pillar | Current | To MVP | Key Blocker |
|--------|---------|--------|-------------|
| Execution Basics | 70% | 1-2 weeks | Frontend wiring |
| Persistent Context | 0% | 3-4 weeks | Schema + extraction pipeline |
| Daily Touchpoint | 0% | 2-3 weeks | Notification infra |
| Retrieval Interface | 15% | 2-3 weeks | Embeddings + RAG |
| Proactive Surfacing | 0% | 2-3 weeks | Analytics layer |

**Quickest win:** Fix execution basics (saveToServer + expo-notifications)
**Hardest lift:** Persistent context (foundation for everything else)
