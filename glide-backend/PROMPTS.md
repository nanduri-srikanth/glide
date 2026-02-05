# Glide LLM Prompts

All prompts used for note processing, summarization, and action extraction.

---

## 1. EXTRACT_ACTIONS - New note from voice memo

**Used in:** `extract_actions()` - Initial note creation from audio
**Model:** llama-3.3-70b-versatile
**Max tokens:** 2000

```
Analyze this voice memo transcript and extract actionable items.

Transcript:
{transcript}

User context:
- Timezone: {timezone}
- Current date: {current_date}
- Your folders: {folders}

## FIELD DEFINITIONS

**narrative** (full content)
- The complete, formatted note content
- What the user reads when they open the note
- Comprehensive — nothing important omitted
- Length scales with input length

**summary** (card preview)
- 2-4 sentence preview for note card/list view
- Captures essence without opening the note
- Always much shorter than narrative
- Think: "What would I want to see in a notification?"

## SUMMARY INSTRUCTIONS
This is YOUR note—write it as a refined version of your own thoughts, not an observer's description.

### Step 1: Detect the Note Type
First, identify what kind of note this is and return type detection metadata:

**MEETING** — Discussion with others, decisions made, follow-ups needed
**BRAINSTORM** — Exploring ideas, possibilities, creative thinking
**TASKS** — List of things to do, errands, action items
**PLANNING** — Strategy, goals, weighing options, making decisions
**REFLECTION** — Personal thoughts, processing feelings, journaling
**TECHNICAL** — Problem-solving, debugging, implementation details
**QUICK_NOTE** — Brief reminder or single thought

Notes can be HYBRID (e.g., PLANNING + TASKS, MEETING + TASKS):
- If content fits multiple types, identify primary_type and secondary_type
- Use hybrid_format: true to blend formatting approaches
- PLANNING + TASKS: Goal/Options/Decision + Action Items section
- MEETING + TASKS: Meeting structure + Follow-ups as checkboxes
- BRAINSTORM + TECHNICAL: Ideas + code/implementation details

### Step 2: Format According to Type

**MEETING format:**
## Context
Who, what, when — one line

## Key Points
- Main discussion topics as bullets
- Decisions made (prefix with ✓)
- Concerns raised

## Follow-ups
What needs to happen next (captured as reminders separately)

**BRAINSTORM format:**
## The Idea
Core concept in 1-2 sentences

## Exploration
Natural prose exploring the idea, connections, possibilities.
Multiple paragraphs for different angles.

## Open Questions
- Unresolved aspects to think through

**TASKS format:**
## Overview
What this batch of tasks is about

## Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

(Individual tasks also captured as reminders)

**PLANNING format:**
## Goal
What I'm trying to achieve

## Options Considered
**Option A:** description, pros/cons
**Option B:** description, pros/cons

## Decision / Next Step
What I decided or need to decide

**REFLECTION format:**
Natural flowing prose. Paragraph breaks between different threads of thought.
Preserve emotional context. No forced structure—let it breathe.

**TECHNICAL format:**
## Problem
What I'm trying to solve

## Approach
How I'm thinking about it / what I tried

## Details
Technical specifics, code concepts, implementation notes

## Status
Where things stand, what's next

**QUICK_NOTE format:**
Just the essential info, 2-4 sentences. No headers needed.

### Voice & Tone
- Match the original register (casual, professional, frustrated, excited)
- First-person where natural
- Preserve personality—don't sanitize or formalize
- Keep nuance and caveats

### Comprehensiveness
- Capture specifics: names, numbers, dates, exact phrasing
- Include reasoning, not just conclusions
- Note uncertainties: *[unclear: audio garbled here]*
- Don't compress into vague summaries

## ACTION EXTRACTION — Intent-Based Classification

For each statement or thought in the transcript, classify the underlying intent:

### Intent Types:

**COMMITMENT_TO_SELF**
- Signals: "I need to", "I should", "gotta", "have to", "want to", "planning to"
- Also catches: Implied self-tasks without explicit markers
- → Creates: Reminder

**COMMITMENT_TO_OTHER**
- Signals: "I'll send", "let them know", "loop in", "update X", "get back to", "follow up with"
- Also catches: Any communication obligation, even without "email" keyword
- → Creates: Email draft OR Reminder (depending on specificity)

**TIME_BINDING**
- Signals: Any date, time, day reference ("Tuesday", "3pm", "next week", "by Friday")
- Combined with people: → Calendar event
- Combined with task: → Reminder with due date
- → Creates: Calendar event OR Reminder with date

**DELEGATION**
- Signals: "Ask X to", "have X do", "X needs to", "waiting on X"
- → Creates: Reminder with context about the delegation

**OPEN_LOOP**
- Signals: "need to figure out", "not sure yet", "have to research", unresolved questions
- → Creates: Entry in `open_loops` array (NOT a reminder unless explicitly actionable)

### Classification Rules:

1. One statement can have MULTIPLE intents
   - "Email Sarah about the Tuesday meeting" = COMMITMENT_TO_OTHER + TIME_BINDING → Email with calendar context

2. Implicit > Explicit
   - "Loop in the design team" = Email, even without the word "email"
   - "Block 2 hours for deep work" = Calendar, even without "schedule" or "meeting"

3. Extract EVERY actionable item
   - If user lists 5 things, create 5 separate reminders
   - Don't collapse "buy milk, eggs, and bread" into one reminder — make three

4. Preserve context in action titles
   - Bad: "Email Sarah"
   - Good: "Email Sarah re: Q3 pricing deck feedback"

5. Distinguish actions from open loops
   - "Need to email Sarah" = Reminder (clear action)
   - "Not sure if we should use Postgres or Supabase" = Open loop (needs resolution first)

## ENTITY AND OPEN LOOP EXTRACTION

As you process the transcript, also extract:

**Related Entities** — People, projects, companies, and concepts mentioned
**Open Loops** — Unresolved items that need future attention but aren't actionable yet

Open loop status types:
- `unresolved`: Needs decision or more info
- `question`: Explicit question raised
- `blocked`: Waiting on external factor
- `deferred`: Consciously postponed

Extract and return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "type_detection": {
    "primary_type": "PLANNING | MEETING | BRAINSTORM | TASKS | REFLECTION | TECHNICAL | QUICK_NOTE",
    "secondary_type": "same options | null",
    "confidence": 0.0-1.0,
    "hybrid_format": true | false,
    "classification_hints": {
      "considered_types": ["TYPE1", "TYPE2"],
      "ambiguity_note": "string explaining uncertainty if confidence < 0.8, otherwise null"
    }
  },
  "title": "Brief descriptive title for this note (5-10 words max)",
  "folder": "{folders_str}",
  "tags": ["relevant", "tags", "max5"],
  "summary": "Summary following the instructions above - match user's tone and style",
  "related_entities": {
    "people": ["names mentioned"],
    "projects": ["project names"],
    "companies": ["company names"],
    "concepts": ["key concepts/topics"]
  },
  "open_loops": [
    {
      "item": "Description of unresolved item",
      "status": "unresolved | question | blocked | deferred",
      "context": "Why this is unresolved / what's needed"
    }
  ],
  "calendar": [
    {
      "title": "Event name",
      "date": "YYYY-MM-DD",
      "time": "HH:MM (24hr, optional)",
      "location": "optional location",
      "attendees": ["optional", "attendees"]
    }
  ],
  "email": [
    {
      "to": "email@example.com or descriptive name",
      "subject": "Email subject line",
      "body": "Draft email body content - be professional and complete"
    }
  ],
  "reminders": [
    {
      "title": "Clear, actionable reminder text with context",
      "due_date": "YYYY-MM-DD",
      "due_time": "HH:MM (optional)",
      "priority": "low|medium|high",
      "intent_source": "COMMITMENT_TO_SELF | COMMITMENT_TO_OTHER | TIME_BINDING | DELEGATION"
    }
  ]
}

Rules:
1. Only extract Calendar, Email, and Reminder actions - nothing else
2. Be thorough - if someone lists multiple items, create a reminder for EACH item
3. Use realistic dates based on context (if "next Tuesday" is mentioned, calculate the actual date)
4. For emails, draft complete professional content with greeting and sign-off placeholder
5. For reminders, make titles clear and actionable WITH CONTEXT (e.g., "Buy groceries for dinner party" not just "groceries")
6. Categorize into the most appropriate folder
7. Extract 2-5 relevant tags
8. If no actions of a type are found, use empty array []
9. Capture open loops separately from actions - don't create reminders for unresolved questions
10. Return ONLY the JSON object, nothing else
```

---

## 2. SYNTHESIZE_CONTENT - Text + audio into cohesive note

**Used in:** `synthesize_content()` - Creating note from text and/or audio
**Model:** llama-3.3-70b-versatile
**Max tokens:** 3000

```
You are helping synthesize a user's thoughts into a cohesive note.
The user may have provided TYPED TEXT and/or SPOKEN AUDIO (transcribed).
Your job is to merge these into ONE coherent narrative that flows naturally.

{combined_content}

User context:
- Timezone: {timezone}
- Current date: {current_date}
- Your folders: {folders}

## FIELD DEFINITIONS

**narrative** (full content)
- The complete, formatted note content
- What the user reads when they open the note
- Comprehensive — nothing important omitted
- Length scales with input length

**summary** (card preview)
- 2-4 sentence preview for note card/list view
- Captures essence without opening the note
- Always much shorter than narrative
- Think: "What would I want to see in a notification?"

## NARRATIVE & SUMMARY INSTRUCTIONS
This is YOUR note—write as a refined version of your own thinking, not a third-party description.

### Step 1: Detect the Note Type
First, identify what kind of note this is and return type detection metadata:

**MEETING** — Discussion with others, decisions made, follow-ups needed
**BRAINSTORM** — Exploring ideas, possibilities, creative thinking
**TASKS** — List of things to do, errands, action items
**PLANNING** — Strategy, goals, weighing options, making decisions
**REFLECTION** — Personal thoughts, processing feelings, journaling
**TECHNICAL** — Problem-solving, debugging, implementation details
**QUICK_NOTE** — Brief reminder or single thought

Notes can be HYBRID (e.g., PLANNING + TASKS, MEETING + TASKS):
- If content fits multiple types, identify primary_type and secondary_type
- Use hybrid_format: true to blend formatting approaches

### Step 2: Format the Narrative According to Type

**MEETING format:**
## Context
Who, what, when — one line

## Key Points
- Main discussion topics as bullets
- Decisions made (prefix with ✓)
- Concerns raised

## Follow-ups
What needs to happen next (captured as reminders separately)

**BRAINSTORM format:**
## The Idea
Core concept in 1-2 sentences

## Exploration
Natural prose exploring the idea, connections, possibilities.
Multiple paragraphs for different angles.

## Open Questions
- Unresolved aspects to think through

**TASKS format:**
## Overview
What this batch of tasks is about

## Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

(Individual tasks also captured as reminders)

**PLANNING format:**
## Goal
What I'm trying to achieve

## Options Considered
**Option A:** description, pros/cons
**Option B:** description, pros/cons

## Decision / Next Step
What I decided or need to decide

**REFLECTION format:**
Natural flowing prose. Paragraph breaks between different threads of thought.
Preserve emotional context. No forced structure—let it breathe.

**TECHNICAL format:**
## Problem
What I'm trying to solve

## Approach
How I'm thinking about it / what I tried

## Details
Technical specifics, code concepts, implementation notes

## Status
Where things stand, what's next

**QUICK_NOTE format:**
Just the essential info, 2-4 sentences. No headers needed.

### Voice & Tone
- Match the original register (casual, professional, frustrated, excited)
- First-person where natural ("I need to..." not "The user needs to...")
- Preserve personality—don't sanitize or formalize
- Keep nuance, caveats, and emotional context

### Comprehensiveness
- Capture specifics: names, numbers, dates, exact phrasing
- Include reasoning, not just conclusions
- Note uncertainties: *[unclear: audio garbled here]*

## NARRATIVE RULES
1. Create a single, cohesive narrative that integrates both inputs naturally
2. Do NOT separate "typed" vs "spoken" - merge them into one flowing text
3. Fix grammar, remove filler words, but PRESERVE the user's voice and intent
4. If there are contradictions, prefer the more recent/specific information

## ACTION EXTRACTION — Intent-Based Classification

For each statement or thought, classify the underlying intent:

### Intent Types:

**COMMITMENT_TO_SELF**
- Signals: "I need to", "I should", "gotta", "have to", "want to", "planning to"
- Also catches: Implied self-tasks without explicit markers
- → Creates: Reminder

**COMMITMENT_TO_OTHER**
- Signals: "I'll send", "let them know", "loop in", "update X", "get back to", "follow up with"
- Also catches: Any communication obligation, even without "email" keyword
- → Creates: Email draft OR Reminder (depending on specificity)

**TIME_BINDING**
- Signals: Any date, time, day reference ("Tuesday", "3pm", "next week", "by Friday")
- Combined with people: → Calendar event
- Combined with task: → Reminder with due date
- → Creates: Calendar event OR Reminder with date

**DELEGATION**
- Signals: "Ask X to", "have X do", "X needs to", "waiting on X"
- → Creates: Reminder with context about the delegation

**OPEN_LOOP**
- Signals: "need to figure out", "not sure yet", "have to research", unresolved questions
- → Creates: Entry in `open_loops` array (NOT a reminder unless explicitly actionable)

### Classification Rules:

1. One statement can have MULTIPLE intents
   - "Email Sarah about the Tuesday meeting" = COMMITMENT_TO_OTHER + TIME_BINDING → Email with calendar context

2. Implicit > Explicit
   - "Loop in the design team" = Email, even without the word "email"
   - "Block 2 hours for deep work" = Calendar, even without "schedule" or "meeting"

3. Extract EVERY actionable item
   - If user lists 5 things, create 5 separate reminders
   - Don't collapse "buy milk, eggs, and bread" into one reminder — make three

4. Preserve context in action titles
   - Bad: "Email Sarah"
   - Good: "Email Sarah re: Q3 pricing deck feedback"

5. Distinguish actions from open loops
   - "Need to email Sarah" = Reminder (clear action)
   - "Not sure if we should use Postgres or Supabase" = Open loop (needs resolution first)

## ENTITY AND OPEN LOOP EXTRACTION

Extract related entities and open loops from the content.

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "type_detection": {
    "primary_type": "PLANNING | MEETING | BRAINSTORM | TASKS | REFLECTION | TECHNICAL | QUICK_NOTE",
    "secondary_type": "same options | null",
    "confidence": 0.0-1.0,
    "hybrid_format": true | false,
    "classification_hints": {
      "considered_types": ["TYPE1", "TYPE2"],
      "ambiguity_note": "string explaining uncertainty if confidence < 0.8, otherwise null"
    }
  },
  "narrative": "The synthesized, cohesive narrative combining all inputs - preserve user's voice",
  "title": "Brief descriptive title for this note (5-10 words max)",
  "folder": "{folders_str}",
  "tags": ["relevant", "tags", "max5"],
  "summary": "2-4 sentence card preview - captures essence for list view",
  "related_entities": {
    "people": ["names mentioned"],
    "projects": ["project names"],
    "companies": ["company names"],
    "concepts": ["key concepts/topics"]
  },
  "open_loops": [
    {
      "item": "Description of unresolved item",
      "status": "unresolved | question | blocked | deferred",
      "context": "Why this is unresolved / what's needed"
    }
  ],
  "calendar": [...],
  "email": [...],
  "reminders": [
    {
      "title": "Clear, actionable reminder text with context",
      "due_date": "YYYY-MM-DD",
      "due_time": "HH:MM (optional)",
      "priority": "low|medium|high",
      "intent_source": "COMMITMENT_TO_SELF | COMMITMENT_TO_OTHER | TIME_BINDING | DELEGATION"
    }
  ]
}

Rules:
1. The narrative should read as ONE cohesive piece, not sections
2. Only extract Calendar, Email, and Reminder actions - nothing else
3. Be thorough with reminders - if someone lists 5 items, create 5 reminders
4. Use realistic dates based on context
5. If no actions of a type are found, use empty array []
6. Capture open loops separately from actions
7. Return ONLY the JSON object, nothing else
```

---

## 3. SUMMARIZE_NEW_CONTENT - Append mode (isolated summary)

**Used in:** `summarize_new_content()` - When appending without re-synthesis
**Model:** llama-3.3-70b-versatile
**Max tokens:** 2000

```
You are summarizing NEW CONTENT being added to an existing note.
This is an addition/update to the note titled: "{existing_title}"

NEW AUDIO TRANSCRIPT:
{new_transcript}

User context:
- Timezone: {timezone}
- Current date: {current_date}

## TASK
Create a well-structured summary of ONLY this new content. This will be appended
to the existing note as a new section.

## FORMATTING GUIDELINES
- Write in first-person, preserving the speaker's voice
- Use markdown formatting where appropriate (headers, bullets, bold)
- Capture ALL specific details: names, numbers, dates, exact phrasing
- Include reasoning and context, not just bare facts
- Match the tone of the original (casual, professional, etc.)
- If this is a continuation of thoughts, frame it as an update/addition

## LENGTH GUIDELINES
- For short additions (< 30 seconds): 2-4 sentences
- For medium additions (30s - 2min): 1-2 paragraphs with bullets if needed
- For longer additions (> 2min): Multiple paragraphs, use headers if topics shift

## ACTION EXTRACTION — Intent-Based Classification

For each statement or thought, classify the underlying intent:

### Intent Types:

**COMMITMENT_TO_SELF**
- Signals: "I need to", "I should", "gotta", "have to", "want to", "planning to"
- → Creates: Reminder

**COMMITMENT_TO_OTHER**
- Signals: "I'll send", "let them know", "loop in", "update X", "get back to", "follow up with"
- → Creates: Email draft OR Reminder

**TIME_BINDING**
- Signals: Any date, time, day reference
- Combined with people: → Calendar event
- Combined with task: → Reminder with due date

**DELEGATION**
- Signals: "Ask X to", "have X do", "X needs to", "waiting on X"
- → Creates: Reminder with context

### Classification Rules:

1. One statement can have MULTIPLE intents
2. Implicit > Explicit ("loop in the team" = Email without "email" keyword)
3. Extract EVERY actionable item separately
4. Preserve context in action titles

Return ONLY valid JSON:
{
  "summary": "Well-structured summary of the new content - comprehensive but focused",
  "tags": ["new", "relevant", "tags"],
  "calendar": [...],
  "email": [...],
  "reminders": [
    {
      "title": "Clear, actionable reminder text with context",
      "due_date": "YYYY-MM-DD",
      "due_time": "HH:MM (optional)",
      "priority": "low|medium|high",
      "intent_source": "COMMITMENT_TO_SELF | COMMITMENT_TO_OTHER | TIME_BINDING | DELEGATION"
    }
  ]
}
```

---

## 4. COMPREHENSIVE_SYNTHESIZE - Re-synthesis (preserve all info)

**Used in:** `comprehensive_synthesize()` - Full re-synthesis with no info loss
**Model:** llama-3.3-70b-versatile
**Max tokens:** 4000

```
You are RE-SYNTHESIZING a note from {input_count} separate inputs.
This is a COMPREHENSIVE re-synthesis - your goal is to PRESERVE ALL INFORMATION.

DO NOT CONDENSE OR LOSE DETAILS. The output should be LONGER and MORE DETAILED
than a typical summary. Users are adding to their notes over time and don't want
information loss when re-synthesizing.

INPUTS TO SYNTHESIZE ({total_words} total words):
{combined_content}

User context:
- Timezone: {timezone}
- Current date: {current_date}
- Your folders: {folders}

## FIELD DEFINITIONS

**narrative** (full content)
- The complete, formatted note content
- What the user reads when they open the note
- Comprehensive — nothing important omitted
- Length scales with input length

**summary** (card preview)
- 2-4 sentence preview for note card/list view
- Captures essence without opening the note
- Always much shorter than narrative
- Think: "What would I want to see in a notification?"

## COMPREHENSIVE SYNTHESIS RULES

1. **PRESERVE EVERYTHING**: Every specific detail, name, number, date, and idea
   from the inputs should be captured in the output.

2. **EXPAND, DON'T CONDENSE**: If the input is 500 words, the narrative should
   be 400-600 words, NOT 100 words. Match or exceed input length.

3. **ORGANIZE BY THEME**: Group related information together, but include ALL of it.

4. **MAINTAIN CHRONOLOGY**: When relevant, preserve the order information was added.

5. **CAPTURE NUANCE**: Include hedging, uncertainty, alternatives mentioned.

## NOTE TYPE DETECTION
First identify what kind of note this is:
- MEETING — Discussion, decisions, follow-ups
- BRAINSTORM — Ideas, possibilities, exploration
- TASKS — To-do items, errands
- PLANNING — Strategy, goals, options
- REFLECTION — Personal thoughts, journaling
- TECHNICAL — Problem-solving, implementation
- QUICK_NOTE — Brief thoughts

Notes can be HYBRID - identify primary and secondary types if applicable.

## FORMATTING (use appropriate format for the type)
- Use markdown headers (##) to organize sections
- Use bullet points for lists
- Use bold for emphasis
- Preserve the user's voice and tone
- First-person where natural

## ACTION EXTRACTION — Intent-Based Classification

For each statement or thought, classify the underlying intent:

### Intent Types:

**COMMITMENT_TO_SELF**
- Signals: "I need to", "I should", "gotta", "have to", "want to", "planning to"
- → Creates: Reminder

**COMMITMENT_TO_OTHER**
- Signals: "I'll send", "let them know", "loop in", "update X", "get back to", "follow up with"
- → Creates: Email draft OR Reminder

**TIME_BINDING**
- Signals: Any date, time, day reference
- Combined with people: → Calendar event
- Combined with task: → Reminder with due date

**DELEGATION**
- Signals: "Ask X to", "have X do", "X needs to", "waiting on X"
- → Creates: Reminder with context

**OPEN_LOOP**
- Signals: "need to figure out", "not sure yet", unresolved questions
- → Creates: Entry in `open_loops` array

### Classification Rules:

1. One statement can have MULTIPLE intents
2. Implicit > Explicit ("loop in the team" = Email)
3. Extract EVERY actionable item separately
4. Preserve context in action titles
5. Distinguish actions from open loops

Return ONLY valid JSON:
{
  "narrative": "COMPREHENSIVE narrative preserving ALL details from all inputs - use markdown formatting",
  "title": "Descriptive title (5-10 words)",
  "folder": "{folders_str}",
  "tags": ["relevant", "tags", "up-to-5"],
  "summary": "2-4 sentence card preview - NOT the full narrative",
  "related_entities": {
    "people": ["names mentioned"],
    "projects": ["project names"],
    "companies": ["company names"],
    "concepts": ["key concepts/topics"]
  },
  "open_loops": [
    {
      "item": "Description of unresolved item",
      "status": "unresolved | question | blocked | deferred",
      "context": "Why this is unresolved / what's needed"
    }
  ],
  "calendar": [...],
  "email": [...],
  "reminders": [
    {
      "title": "Clear, actionable reminder text with context",
      "due_date": "YYYY-MM-DD",
      "due_time": "HH:MM (optional)",
      "priority": "low|medium|high",
      "intent_source": "COMMITMENT_TO_SELF | COMMITMENT_TO_OTHER | TIME_BINDING | DELEGATION"
    }
  ]
}

CRITICAL: The narrative should be COMPREHENSIVE. If 5 items were discussed,
all 5 should appear. If reasoning was given, include the reasoning.
DO NOT summarize away important details.
```

---

## 5. EXTRACT_ACTIONS_FOR_APPEND - Legacy append (actions only)

**Used in:** `extract_actions_for_append()` - Extract only NEW actions
**Model:** llama-3.3-70b-versatile
**Max tokens:** 2000

```
You are analyzing ADDITIONAL audio that was recorded and appended to an existing note.
Your task is to extract ONLY NEW actionable items from the new audio that are NOT already covered in the existing note.

EXISTING NOTE TITLE: {existing_title}

EXISTING NOTE TRANSCRIPT:
{existing_transcript}

---

NEW AUDIO TRANSCRIPT (just recorded):
{new_transcript}

User context:
- Timezone: {timezone}
- Current date: {current_date}

## ACTION EXTRACTION — Intent-Based Classification

For each statement or thought in the NEW content, classify the underlying intent:

### Intent Types:

**COMMITMENT_TO_SELF**
- Signals: "I need to", "I should", "gotta", "have to", "want to", "planning to"
- → Creates: Reminder

**COMMITMENT_TO_OTHER**
- Signals: "I'll send", "let them know", "loop in", "update X", "get back to", "follow up with"
- → Creates: Email draft OR Reminder

**TIME_BINDING**
- Signals: Any date, time, day reference
- Combined with people: → Calendar event
- Combined with task: → Reminder with due date

**DELEGATION**
- Signals: "Ask X to", "have X do", "X needs to", "waiting on X"
- → Creates: Reminder with context

### Classification Rules:

1. One statement can have MULTIPLE intents
2. Implicit > Explicit ("loop in the team" = Email without "email" keyword)
3. Extract EVERY actionable item separately
4. Preserve context in action titles

IMPORTANT: Only extract actions from the NEW transcript that are genuinely new additions.
Do NOT duplicate actions that are already implied by the existing transcript.
If the new audio is just a continuation of the same thought with no new actions, return empty arrays.

Extract and return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "title": "{existing_title}",
  "folder": "Keep the same folder",
  "tags": ["any", "new", "tags", "only"],
  "summary": "Brief summary of what NEW information was added",
  "calendar": [...],
  "email": [...],
  "reminders": [
    {
      "title": "Clear, actionable reminder text with context",
      "due_date": "YYYY-MM-DD",
      "due_time": "HH:MM (optional)",
      "priority": "low|medium|high",
      "intent_source": "COMMITMENT_TO_SELF | COMMITMENT_TO_OTHER | TIME_BINDING | DELEGATION"
    }
  ]
}

Rules:
1. Only extract Calendar, Email, and Reminder actions - nothing else
2. ONLY include actions explicitly mentioned in the NEW transcript
3. Do NOT duplicate any actions implied by the existing transcript
4. If someone lists multiple items, create a reminder for EACH item
5. If no new actions are found, use empty arrays []
6. The title should remain the same as the existing title
7. Only add new tags that are relevant to the new content
8. Return ONLY the JSON object, nothing else
```

---

## 6. SMART_SYNTHESIZE - Auto-decide append vs resynthesize

**Used in:** `smart_synthesize()` - AI decides update strategy
**Model:** llama-3.3-70b-versatile
**Max tokens:** 4000

```
You are helping update an existing note with new content.
Analyze the existing note and new content, then decide the best update strategy.

EXISTING NOTE:
Title: {existing_title}
Content: {existing_narrative}
Summary: {existing_summary}

NEW CONTENT TO ADD:
{new_content}

User context:
- Timezone: {timezone}
- Current date: {current_date}

## FIELD DEFINITIONS

**narrative** (full content)
- The complete, formatted note content
- What the user reads when they open the note
- Comprehensive — nothing important omitted
- Length scales with input length

**summary** (card preview)
- 2-4 sentence preview for note card/list view
- Captures essence without opening the note
- Always much shorter than narrative
- Think: "What would I want to see in a notification?"

DECISION CRITERIA:
- Choose RESYNTHESIZE if:
  * New content contradicts or corrects existing content
  * Topic has shifted significantly
  * New content changes the meaning/intent of the note
  * Major updates that change >30% of the content meaning
- Choose APPEND if:
  * New content is purely additive (new details, additions)
  * Same topic, no contradictions
  * Just expanding on existing points

## ACTION EXTRACTION — Intent-Based Classification

For each statement or thought, classify the underlying intent:

### Intent Types:

**COMMITMENT_TO_SELF**
- Signals: "I need to", "I should", "gotta", "have to", "want to", "planning to"
- → Creates: Reminder

**COMMITMENT_TO_OTHER**
- Signals: "I'll send", "let them know", "loop in", "update X", "get back to", "follow up with"
- → Creates: Email draft OR Reminder

**TIME_BINDING**
- Signals: Any date, time, day reference
- Combined with people: → Calendar event
- Combined with task: → Reminder with due date

**DELEGATION**
- Signals: "Ask X to", "have X do", "X needs to", "waiting on X"
- → Creates: Reminder with context

### Classification Rules:

1. One statement can have MULTIPLE intents
2. Implicit > Explicit ("loop in the team" = Email without "email" keyword)
3. Extract EVERY actionable item separately
4. Preserve context in action titles

Return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "decision": {
    "update_type": "append" or "resynthesize",
    "confidence": 0.0 to 1.0,
    "reason": "Brief explanation"
  },
  "result": {
    "narrative": "The FULL updated note content (either appended or fully resynthesized)",
    "title": "Updated title if changed, otherwise keep existing",
    "folder": "Work|Personal|Ideas|Meetings|Projects",
    "tags": ["relevant", "tags"],
    "summary": "2-4 sentence card preview - NOT the full narrative",
    "calendar": [],
    "email": [],
    "reminders": [
      {
        "title": "Clear, actionable reminder text with context",
        "due_date": "YYYY-MM-DD",
        "due_time": "HH:MM (optional)",
        "priority": "low|medium|high",
        "intent_source": "COMMITMENT_TO_SELF | COMMITMENT_TO_OTHER | TIME_BINDING | DELEGATION"
      }
    ]
  }
}

IMPORTANT:
- If appending, the narrative should seamlessly integrate the new content
- If resynthesizing, create a completely fresh narrative from all information
- Always return the COMPLETE narrative, not just changes
- Only extract Calendar, Email, and Reminder actions - nothing else
```

---

## 7. SUMMARIZE_NOTE - Standalone summary generation

**Used in:** `summarize_note()` - Generate summary for existing note
**Model:** llama-3.3-70b-versatile
**Max tokens:** 1000

```
This is YOUR note—write a refined, well-structured version of your own thinking.

TRANSCRIPT:
{transcript}

## Step 1: Detect the Note Type
First, identify what kind of note this is:
- MEETING — Discussion with others, decisions, follow-ups
- BRAINSTORM — Exploring ideas, possibilities, creative thinking
- TASKS — List of things to do, errands, action items
- PLANNING — Strategy, goals, weighing options
- REFLECTION — Personal thoughts, processing feelings
- TECHNICAL — Problem-solving, debugging, implementation
- QUICK_NOTE — Brief reminder or single thought

Notes can be HYBRID (e.g., PLANNING + TASKS):
- If content fits multiple types, blend formatting approaches
- PLANNING + TASKS: Goal/Options/Decision + Action Items section
- MEETING + TASKS: Meeting structure + Follow-ups as checkboxes

## Step 2: Format According to Type

For MEETING: Use "## Context", "## Key Points" (bullets), "## Follow-ups"
For BRAINSTORM: Use "## The Idea", "## Exploration" (prose), "## Open Questions"
For TASKS: Use "## Overview", "## Tasks" (checkbox list)
For PLANNING: Use "## Goal", "## Options Considered", "## Decision"
For REFLECTION: Natural flowing prose with paragraph breaks, no headers
For TECHNICAL: Use "## Problem", "## Approach", "## Details", "## Status"
For QUICK_NOTE: Just 2-4 sentences, no headers needed

## Voice & Tone
- Same voice and personality as the original
- First-person where natural
- Preserve emotional context (frustration, excitement, uncertainty)
- Don't sanitize or formalize

## Comprehensiveness
- Capture specifics: names, numbers, dates, exact phrasing
- Include reasoning, not just conclusions
- Note uncertainties: *[unclear: audio garbled here]*

## Length
{length_guidance based on duration}

Return only the formatted note text (with markdown headers/bullets as appropriate for the type).
```

---

## 8. GENERATE_EMAIL_DRAFT - Email generation

**Used in:** `generate_email_draft()` - Create email from context
**Model:** llama-3.3-70b-versatile
**Max tokens:** 1000

```
Generate a professional email draft.

Context from voice memo: {context}
Recipient: {recipient}
Purpose: {purpose}

Return JSON with:
{
  "subject": "Email subject line",
  "body": "Full email body with proper greeting and signature placeholder"
}

Return ONLY valid JSON.
```

---

## JSON Output Schema (common across prompts)

```json
{
  "type_detection": {
    "primary_type": "PLANNING | MEETING | BRAINSTORM | TASKS | REFLECTION | TECHNICAL | QUICK_NOTE",
    "secondary_type": "same options | null",
    "confidence": 0.0-1.0,
    "hybrid_format": true | false,
    "classification_hints": {
      "considered_types": ["TYPE1", "TYPE2"],
      "ambiguity_note": "string | null"
    }
  },
  "title": "string (5-10 words)",
  "folder": "Work | Personal | Ideas | Meetings | Projects",
  "tags": ["max", "5", "tags"],
  "narrative": "Full formatted note content",
  "summary": "2-4 sentence card preview",
  "related_entities": {
    "people": ["string"],
    "projects": ["string"],
    "companies": ["string"],
    "concepts": ["string"]
  },
  "open_loops": [
    {
      "item": "string",
      "status": "unresolved | question | blocked | deferred",
      "context": "string"
    }
  ],
  "calendar": [
    {
      "title": "Event name",
      "date": "YYYY-MM-DD",
      "time": "HH:MM (optional)",
      "location": "string (optional)",
      "attendees": ["array", "of", "strings"]
    }
  ],
  "email": [
    {
      "to": "recipient email or name",
      "subject": "Email subject",
      "body": "Full email body"
    }
  ],
  "reminders": [
    {
      "title": "Task description with context",
      "due_date": "YYYY-MM-DD",
      "due_time": "HH:MM (optional)",
      "priority": "low|medium|high",
      "intent_source": "COMMITMENT_TO_SELF | COMMITMENT_TO_OTHER | TIME_BINDING | DELEGATION"
    }
  ]
}
```

---

## Verification Test Cases

Use these scenarios to verify the prompts are working correctly:

| Scenario | Expected |
|----------|----------|
| "Meeting with Sarah Tuesday at 3 about the rebrand. Need to prep the deck before." | Calendar event (Sarah, Tuesday 3pm) + Reminder (prep deck), TIME_BINDING intent |
| "Thinking through pricing... could do freemium or flat rate. Leaning toward freemium. Need to model out the numbers." | BRAINSTORM/PLANNING type, open_loop for "model out numbers", no false-positive actions |
| "Buy milk, eggs, bread, and pick up dry cleaning" | 4 separate reminders, TASKS type, COMMITMENT_TO_SELF intent |
| "Loop in Mike on the API issue" | Email draft to Mike (even without "email" keyword), COMMITMENT_TO_OTHER intent |
| "Not sure if we should use Postgres or Supabase, need to research" | Open loop captured, no premature reminder action |
| "Ask Sarah to send the Q3 report" | Reminder with DELEGATION intent, not an email (delegation to Sarah) |
