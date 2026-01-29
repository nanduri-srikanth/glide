"""LLM service using Groq for fast action extraction."""
import json
from datetime import datetime
from typing import Optional

from app.config import get_settings
from app.schemas.voice_schemas import ActionExtractionResult


class LLMService:
    """Service for AI-powered action extraction using Groq LLM."""

    # Groq model to use - llama-3.3-70b-versatile for best quality
    MODEL = "llama-3.3-70b-versatile"

    def __init__(self):
        settings = get_settings()
        self.client = None

        if settings.groq_api_key:
            from groq import Groq
            self.client = Groq(api_key=settings.groq_api_key)

    async def extract_actions(
        self,
        transcript: str,
        user_context: Optional[dict] = None
    ) -> ActionExtractionResult:
        """
        Analyze transcript and extract actionable items using Groq LLM.

        Args:
            transcript: The transcribed text from voice memo
            user_context: Optional context about the user (timezone, preferences)

        Returns:
            ActionExtractionResult with structured actions
        """
        # Return mock response when API key not configured (local dev mode)
        if not self.client:
            return self._mock_extraction(transcript)

        # Get user's folders or use defaults
        folders_list = ['Work', 'Personal', 'Ideas', 'Meetings', 'Projects']
        if user_context and user_context.get('folders'):
            folders_list = user_context.get('folders')
        folders_str = '|'.join(folders_list)

        context_str = ""
        if user_context:
            context_str = f"""
User context:
- Timezone: {user_context.get('timezone', 'America/Chicago')}
- Current date: {user_context.get('current_date', 'today')}
- Your folders: {', '.join(folders_list)}
"""

        prompt = f"""Analyze this voice memo transcript and extract actionable items.

Transcript:
{transcript}

{context_str}

## SUMMARY INSTRUCTIONS
This is YOUR note—write it as a refined version of your own thoughts, not an observer's description.

### Step 1: Detect the Note Type
First, identify what kind of note this is:

**MEETING** — Discussion with others, decisions made, follow-ups needed
**BRAINSTORM** — Exploring ideas, possibilities, creative thinking
**TASKS** — List of things to do, errands, action items
**PLANNING** — Strategy, goals, weighing options, making decisions
**REFLECTION** — Personal thoughts, processing feelings, journaling
**TECHNICAL** — Problem-solving, debugging, implementation details
**QUICK_NOTE** — Brief reminder or single thought

### Step 2: Format According to Type

**MEETING format:**
```
## Context
Who, what, when — one line

## Key Points
- Main discussion topics as bullets
- Decisions made (prefix with ✓)
- Concerns raised

## Follow-ups
What needs to happen next (captured as reminders separately)
```

**BRAINSTORM format:**
```
## The Idea
Core concept in 1-2 sentences

## Exploration
Natural prose exploring the idea, connections, possibilities.
Multiple paragraphs for different angles.

## Open Questions
- Unresolved aspects to think through
```

**TASKS format:**
```
## Overview
What this batch of tasks is about

## Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

(Individual tasks also captured as reminders)
```

**PLANNING format:**
```
## Goal
What I'm trying to achieve

## Options Considered
**Option A:** description, pros/cons
**Option B:** description, pros/cons

## Decision / Next Step
What I decided or need to decide
```

**REFLECTION format:**
Natural flowing prose. Paragraph breaks between different threads of thought.
Preserve emotional context. No forced structure—let it breathe.

**TECHNICAL format:**
```
## Problem
What I'm trying to solve

## Approach
How I'm thinking about it / what I tried

## Details
Technical specifics, code concepts, implementation notes

## Status
Where things stand, what's next
```

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

## PATTERN RECOGNITION - Look for these specific patterns:

CALENDAR EVENTS - Create when you detect:
- Meetings: "meeting with", "call with", "sync with", "catch up with"
- Appointments: "appointment", "scheduled for", "at [time]", "on [date]"
- Events: "dinner", "lunch", "conference", "presentation", "interview"
- Time references: specific dates, "next Monday", "tomorrow at 3pm"

EMAIL ACTIONS - Create when you detect:
- Direct mentions: "email", "send", "write to", "reply to", "follow up with"
- Communication intent: "let them know", "inform", "update [person]", "reach out to"
- Include recipient, subject, and draft the email body based on context

REMINDERS - Create when you detect:
- Task lists: "I need to", "don't forget to", "remember to", "make sure to"
- To-do items: "buy", "pick up", "call", "check", "review", "submit"
- Deadlines: "by Friday", "before the meeting", "this week"
- Any item in a list format (numbered or bulleted mentally)

Extract and return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{{
  "title": "Brief descriptive title for this note (5-10 words max)",
  "folder": "{folders_str}",
  "tags": ["relevant", "tags", "max5"],
  "summary": "Summary following the instructions above - match user's tone and style",
  "calendar": [
    {{
      "title": "Event name",
      "date": "YYYY-MM-DD",
      "time": "HH:MM (24hr, optional)",
      "location": "optional location",
      "attendees": ["optional", "attendees"]
    }}
  ],
  "email": [
    {{
      "to": "email@example.com or descriptive name",
      "subject": "Email subject line",
      "body": "Draft email body content - be professional and complete"
    }}
  ],
  "reminders": [
    {{
      "title": "Clear, actionable reminder text",
      "due_date": "YYYY-MM-DD",
      "due_time": "HH:MM (optional)",
      "priority": "low|medium|high"
    }}
  ]
}}

Rules:
1. Only extract Calendar, Email, and Reminder actions - nothing else
2. Be thorough - if someone lists multiple items, create a reminder for EACH item
3. Use realistic dates based on context (if "next Tuesday" is mentioned, calculate the actual date)
4. For emails, draft complete professional content with greeting and sign-off placeholder
5. For reminders, make titles clear and actionable (e.g., "Buy groceries" not just "groceries")
6. Categorize into the most appropriate folder
7. Extract 2-5 relevant tags
8. If no actions of a type are found, use empty array []
9. Return ONLY the JSON object, nothing else"""

        response = self.client.chat.completions.create(
            model=self.MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        # Parse JSON response
        response_text = response.choices[0].message.content.strip()

        # Handle potential markdown code blocks
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()

        try:
            data = json.loads(response_text)
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return ActionExtractionResult(
                title="Voice Note",
                folder="Personal",
                tags=[],
                summary=transcript[:200] + "..." if len(transcript) > 200 else transcript,
                calendar=[],
                email=[],
                reminders=[],
                next_steps=[],
            )

        return ActionExtractionResult(
            title=data.get("title", "Voice Note"),
            folder=data.get("folder", "Personal"),
            tags=data.get("tags", [])[:5],  # Limit to 5 tags
            summary=data.get("summary"),
            calendar=data.get("calendar", []),
            email=data.get("email", []),
            reminders=data.get("reminders", []),
            next_steps=[],  # Deprecated - no longer extracting next_steps
        )

    def _mock_extraction(self, transcript: str) -> ActionExtractionResult:
        """Return mock extraction result for local dev (no API key)."""
        # Generate a simple title from the transcript
        words = transcript.split()[:10]
        title = " ".join(words) + ("..." if len(transcript.split()) > 10 else "")
        if not title.strip():
            title = f"Voice Note - {datetime.utcnow().strftime('%b %d, %Y %I:%M %p')}"

        # Create a summary from the first 200 chars
        summary = transcript[:200] + ("..." if len(transcript) > 200 else "")

        return ActionExtractionResult(
            title=title,
            folder="Personal",
            tags=[],
            summary=summary if summary.strip() else None,
            calendar=[],
            email=[],
            reminders=[],
            next_steps=[],
        )

    async def extract_actions_for_append(
        self,
        new_transcript: str,
        existing_transcript: str,
        existing_title: str,
        user_context: Optional[dict] = None
    ) -> ActionExtractionResult:
        """
        Extract actions from new audio appended to an existing note.
        Designed to avoid duplicating actions already captured in the original note.

        Args:
            new_transcript: The newly transcribed text
            existing_transcript: The existing note's transcript
            existing_title: The existing note's title
            user_context: Optional context about the user

        Returns:
            ActionExtractionResult with only NEW actions
        """
        # Return mock response when API key not configured
        if not self.client:
            return self._mock_extraction(new_transcript)

        context_str = ""
        if user_context:
            context_str = f"""
User context:
- Timezone: {user_context.get('timezone', 'America/Chicago')}
- Current date: {user_context.get('current_date', 'today')}
"""

        prompt = f"""You are analyzing ADDITIONAL audio that was recorded and appended to an existing note.
Your task is to extract ONLY NEW actionable items from the new audio that are NOT already covered in the existing note.

EXISTING NOTE TITLE: {existing_title}

EXISTING NOTE TRANSCRIPT:
{existing_transcript}

---

NEW AUDIO TRANSCRIPT (just recorded):
{new_transcript}

{context_str}

PATTERN RECOGNITION - Look for these specific patterns in the NEW content:

CALENDAR EVENTS - Create when you detect:
- Meetings: "meeting with", "call with", "sync with", "catch up with"
- Appointments: "appointment", "scheduled for", "at [time]", "on [date]"
- Events: "dinner", "lunch", "conference", "presentation", "interview"

EMAIL ACTIONS - Create when you detect:
- Direct mentions: "email", "send", "write to", "reply to", "follow up with"
- Communication intent: "let them know", "inform", "update [person]"

REMINDERS - Create when you detect:
- Task lists: "I need to", "don't forget to", "remember to", "make sure to"
- To-do items: any actionable task mentioned
- Each item in a list should be a separate reminder

IMPORTANT: Only extract actions from the NEW transcript that are genuinely new additions.
Do NOT duplicate actions that are already implied by the existing transcript.
If the new audio is just a continuation of the same thought with no new actions, return empty arrays.

Extract and return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{{
  "title": "{existing_title}",
  "folder": "Keep the same folder",
  "tags": ["any", "new", "tags", "only"],
  "summary": "Brief summary of what NEW information was added",
  "calendar": [
    {{
      "title": "NEW Event name",
      "date": "YYYY-MM-DD",
      "time": "HH:MM (24hr, optional)",
      "location": "optional location",
      "attendees": ["optional", "attendees"]
    }}
  ],
  "email": [
    {{
      "to": "email@example.com or name",
      "subject": "NEW Email subject",
      "body": "Draft email body - complete and professional"
    }}
  ],
  "reminders": [
    {{
      "title": "Clear, actionable reminder text",
      "due_date": "YYYY-MM-DD",
      "due_time": "HH:MM (optional)",
      "priority": "low|medium|high"
    }}
  ]
}}

Rules:
1. Only extract Calendar, Email, and Reminder actions - nothing else
2. ONLY include actions explicitly mentioned in the NEW transcript
3. Do NOT duplicate any actions implied by the existing transcript
4. If someone lists multiple items, create a reminder for EACH item
5. If no new actions are found, use empty arrays []
6. The title should remain the same as the existing title
7. Only add new tags that are relevant to the new content
8. Return ONLY the JSON object, nothing else"""

        response = self.client.chat.completions.create(
            model=self.MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        # Parse JSON response
        response_text = response.choices[0].message.content.strip()

        # Handle potential markdown code blocks
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()

        try:
            data = json.loads(response_text)
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails - return empty actions
            return ActionExtractionResult(
                title=existing_title,
                folder="Personal",
                tags=[],
                summary=f"Added: {new_transcript[:100]}..." if len(new_transcript) > 100 else f"Added: {new_transcript}",
                calendar=[],
                email=[],
                reminders=[],
                next_steps=[],
            )

        return ActionExtractionResult(
            title=data.get("title", existing_title),
            folder=data.get("folder", "Personal"),
            tags=data.get("tags", [])[:5],
            summary=data.get("summary"),
            calendar=data.get("calendar", []),
            email=data.get("email", []),
            reminders=data.get("reminders", []),
            next_steps=[],  # Deprecated - no longer extracting next_steps
        )

    async def generate_email_draft(
        self,
        context: str,
        recipient: str,
        purpose: str
    ) -> dict:
        """
        Generate a polished email draft based on context.

        Args:
            context: Context from the voice memo
            recipient: Who the email is for
            purpose: Purpose of the email

        Returns:
            dict with subject and body
        """
        # Return mock response when API key not configured
        if not self.client:
            return {
                "subject": f"Re: {purpose}",
                "body": f"[AI draft unavailable - connect Groq API]\n\nContext: {context[:200]}..."
            }

        prompt = f"""Generate a professional email draft.

Context from voice memo: {context}
Recipient: {recipient}
Purpose: {purpose}

Return JSON with:
{{
  "subject": "Email subject line",
  "body": "Full email body with proper greeting and signature placeholder"
}}

Return ONLY valid JSON."""

        response = self.client.chat.completions.create(
            model=self.MODEL,
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.choices[0].message.content.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()

        return json.loads(response_text)

    async def synthesize_content(
        self,
        text_input: str = "",
        audio_transcript: str = "",
        user_context: Optional[dict] = None
    ) -> dict:
        """
        Synthesize text input and audio transcription into a cohesive narrative.

        Args:
            text_input: User's typed text
            audio_transcript: Transcribed audio content
            user_context: Optional context about the user

        Returns:
            dict with narrative, title, folder, tags, summary, and extracted actions
        """
        # Combine inputs for context
        combined_content = ""
        if text_input and audio_transcript:
            combined_content = f"TYPED TEXT:\n{text_input}\n\nSPOKEN AUDIO:\n{audio_transcript}"
        elif text_input:
            combined_content = text_input
        elif audio_transcript:
            combined_content = audio_transcript
        else:
            # No content provided
            return {
                "narrative": "",
                "title": "Empty Note",
                "folder": "Personal",
                "tags": [],
                "summary": None,
                "calendar": [],
                "email": [],
                "reminders": [],
                "next_steps": [],
            }

        # Return mock response when API key not configured
        if not self.client:
            return self._mock_synthesis(combined_content, text_input, audio_transcript)

        # Get user's folders or use defaults
        folders_list = ['Work', 'Personal', 'Ideas', 'Meetings', 'Projects']
        if user_context and user_context.get('folders'):
            folders_list = user_context.get('folders')
        folders_str = '|'.join(folders_list)

        context_str = ""
        if user_context:
            context_str = f"""
User context:
- Timezone: {user_context.get('timezone', 'America/Chicago')}
- Current date: {user_context.get('current_date', 'today')}
- Your folders: {', '.join(folders_list)}
"""

        prompt = f"""You are helping synthesize a user's thoughts into a cohesive note.
The user may have provided TYPED TEXT and/or SPOKEN AUDIO (transcribed).
Your job is to merge these into ONE coherent narrative that flows naturally.

{combined_content}

{context_str}

## NARRATIVE & SUMMARY INSTRUCTIONS
This is YOUR note—write as a refined version of your own thinking, not a third-party description.

### Step 1: Detect the Note Type
First, identify what kind of note this is:

**MEETING** — Discussion with others, decisions made, follow-ups needed
**BRAINSTORM** — Exploring ideas, possibilities, creative thinking
**TASKS** — List of things to do, errands, action items
**PLANNING** — Strategy, goals, weighing options, making decisions
**REFLECTION** — Personal thoughts, processing feelings, journaling
**TECHNICAL** — Problem-solving, debugging, implementation details
**QUICK_NOTE** — Brief reminder or single thought

### Step 2: Format the Narrative According to Type

**MEETING format:**
```
## Context
Who, what, when — one line

## Key Points
- Main discussion topics as bullets
- Decisions made (prefix with ✓)
- Concerns raised

## Follow-ups
What needs to happen next
```

**BRAINSTORM format:**
```
## The Idea
Core concept in 1-2 sentences

## Exploration
Natural prose exploring the idea, connections, possibilities.
Multiple paragraphs for different angles.

## Open Questions
- Unresolved aspects to think through
```

**TASKS format:**
```
## Overview
What this batch of tasks is about

## Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
```

**PLANNING format:**
```
## Goal
What I'm trying to achieve

## Options Considered
**Option A:** description, pros/cons
**Option B:** description, pros/cons

## Decision / Next Step
What I decided or need to decide
```

**REFLECTION format:**
Natural flowing prose. Paragraph breaks between different threads of thought.
Preserve emotional context. No forced structure—let it breathe.

**TECHNICAL format:**
```
## Problem
What I'm trying to solve

## Approach
How I'm thinking about it / what I tried

## Details
Technical specifics, implementation notes

## Status
Where things stand, what's next
```

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

## PATTERN RECOGNITION - Look for these specific patterns:

CALENDAR EVENTS - Create when you detect:
- Meetings: "meeting with", "call with", "sync with", "catch up with"
- Appointments: "appointment", "scheduled for", "at [time]", "on [date]"
- Events: "dinner", "lunch", "conference", "presentation", "interview"
- Time references: specific dates, "next Monday", "tomorrow at 3pm"

EMAIL ACTIONS - Create when you detect:
- Direct mentions: "email", "send", "write to", "reply to", "follow up with"
- Communication intent: "let them know", "inform", "update [person]", "reach out to"
- Include recipient, subject, and draft the complete email body

REMINDERS - Create when you detect:
- Task lists: "I need to", "don't forget to", "remember to", "make sure to"
- To-do items: "buy", "pick up", "call", "check", "review", "submit"
- Deadlines: "by Friday", "before the meeting", "this week"
- Lists of items: each item in a list becomes a SEPARATE reminder
- Shopping lists, errands, tasks - each item is a reminder

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{{
  "narrative": "The synthesized, cohesive narrative combining all inputs - preserve user's voice",
  "title": "Brief descriptive title for this note (5-10 words max)",
  "folder": "{folders_str}",
  "tags": ["relevant", "tags", "max5"],
  "summary": "Summary following instructions above - match user's tone and length to content",
  "calendar": [
    {{
      "title": "Event name",
      "date": "YYYY-MM-DD",
      "time": "HH:MM (24hr, optional)",
      "location": "optional location",
      "attendees": ["optional", "attendees"]
    }}
  ],
  "email": [
    {{
      "to": "email@example.com or descriptive name",
      "subject": "Email subject line",
      "body": "Draft email body content - complete and professional"
    }}
  ],
  "reminders": [
    {{
      "title": "Clear, actionable reminder text",
      "due_date": "YYYY-MM-DD",
      "due_time": "HH:MM (optional)",
      "priority": "low|medium|high"
    }}
  ]
}}

Rules:
1. The narrative should read as ONE cohesive piece, not sections
2. Only extract Calendar, Email, and Reminder actions - nothing else
3. Be thorough with reminders - if someone lists 5 items, create 5 reminders
4. Use realistic dates based on context
5. If no actions of a type are found, use empty array []
6. Return ONLY the JSON object, nothing else"""

        response = self.client.chat.completions.create(
            model=self.MODEL,
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}]
        )

        # Parse JSON response
        response_text = response.choices[0].message.content.strip()

        # Handle potential markdown code blocks
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()

        try:
            data = json.loads(response_text)
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return {
                "narrative": combined_content,
                "title": "Voice Note",
                "folder": "Personal",
                "tags": [],
                "summary": combined_content[:200] + "..." if len(combined_content) > 200 else combined_content,
                "calendar": [],
                "email": [],
                "reminders": [],
                "next_steps": [],
            }

        return {
            "narrative": data.get("narrative", combined_content),
            "title": data.get("title", "Voice Note"),
            "folder": data.get("folder", "Personal"),
            "tags": data.get("tags", [])[:5],
            "summary": data.get("summary"),
            "calendar": data.get("calendar", []),
            "email": data.get("email", []),
            "reminders": data.get("reminders", []),
            "next_steps": [],  # Deprecated
        }

    def _mock_synthesis(self, combined: str, text: str, audio: str) -> dict:
        """Return mock synthesis result for local dev (no API key)."""
        # Use combined content as narrative
        narrative = combined
        if text and audio:
            narrative = f"{text}\n\n{audio}"
        elif text:
            narrative = text
        elif audio:
            narrative = audio

        # Generate title from first line
        words = narrative.split()[:10]
        title = " ".join(words) + ("..." if len(narrative.split()) > 10 else "")
        if not title.strip():
            title = f"Note - {datetime.utcnow().strftime('%b %d, %Y %I:%M %p')}"

        return {
            "narrative": narrative,
            "title": title,
            "folder": "Personal",
            "tags": [],
            "summary": narrative[:200] + "..." if len(narrative) > 200 else narrative,
            "calendar": [],
            "email": [],
            "reminders": [],
            "next_steps": [],
        }

    async def resynthesize_content(
        self,
        input_history: list,
        user_context: Optional[dict] = None
    ) -> dict:
        """
        Re-synthesize content from a history of inputs.
        Used when user edits and wants to regenerate the narrative.

        Args:
            input_history: List of InputHistoryEntry-like dicts with type and content
            user_context: Optional context about the user

        Returns:
            dict with narrative, title, folder, tags, summary, and extracted actions
        """
        # Combine all inputs in chronological order
        text_parts = []
        audio_parts = []

        for entry in input_history:
            if entry.get("type") == "text":
                text_parts.append(entry.get("content", ""))
            elif entry.get("type") == "audio":
                audio_parts.append(entry.get("content", ""))

        text_input = "\n\n".join(text_parts) if text_parts else ""
        audio_transcript = "\n\n".join(audio_parts) if audio_parts else ""

        return await self.synthesize_content(text_input, audio_transcript, user_context)

    def should_force_resynthesize(
        self,
        existing_narrative: str,
        new_content: str,
        input_history: list
    ) -> tuple[bool, str | None]:
        """
        Heuristic pre-checks to determine if we should force a full resynthesize.
        Returns (should_force, reason) tuple.
        """
        existing_len = len(existing_narrative.split())
        new_len = len(new_content.split())

        # Force resynthesize if new content is >50% of existing length
        if existing_len > 0 and new_len > existing_len * 0.5:
            return True, "New content is substantial relative to existing note"

        # Force resynthesize if we have 5+ fragmented inputs
        if len(input_history) >= 5:
            return True, "Multiple fragmented inputs benefit from full synthesis"

        # Force resynthesize if existing note is very short (<50 words)
        if existing_len < 50:
            return True, "Short note benefits from full synthesis"

        return False, None

    async def smart_synthesize(
        self,
        new_content: str,
        existing_narrative: str,
        existing_title: str,
        existing_summary: str | None,
        input_history: list,
        user_context: Optional[dict] = None
    ) -> dict:
        """
        Intelligently decide whether to append or resynthesize, then do it.
        Returns dict with decision info and synthesized result.
        """
        # Check heuristics first
        force_resynth, force_reason = self.should_force_resynthesize(
            existing_narrative, new_content, input_history
        )

        if force_resynth:
            # Add new content to history and do full resynthesize
            result = await self.resynthesize_content(input_history, user_context)
            return {
                "decision": {
                    "update_type": "resynthesize",
                    "confidence": 0.95,
                    "reason": force_reason or "Heuristic check determined resynthesize needed"
                },
                "result": result
            }

        # Return mock response when API key not configured
        if not self.client:
            return self._mock_smart_synthesis(
                new_content, existing_narrative, existing_title, input_history
            )

        context_str = ""
        if user_context:
            context_str = f"""
User context:
- Timezone: {user_context.get('timezone', 'America/Chicago')}
- Current date: {user_context.get('current_date', 'today')}
"""

        prompt = f"""You are helping update an existing note with new content.
Analyze the existing note and new content, then decide the best update strategy.

EXISTING NOTE:
Title: {existing_title}
Content: {existing_narrative}
Summary: {existing_summary or 'None'}

NEW CONTENT TO ADD:
{new_content}

{context_str}

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

PATTERN RECOGNITION for actions - Look for:

CALENDAR: meetings, appointments, events with dates/times
EMAIL: "email", "send to", "write to", "follow up with", communication intent
REMINDERS: task lists, to-do items, "need to", "don't forget", each list item = separate reminder

Return ONLY valid JSON (no markdown, no explanation) with this structure:
{{
  "decision": {{
    "update_type": "append" or "resynthesize",
    "confidence": 0.0 to 1.0,
    "reason": "Brief explanation"
  }},
  "result": {{
    "narrative": "The FULL updated note content (either appended or fully resynthesized)",
    "title": "Updated title if changed, otherwise keep existing",
    "folder": "Work|Personal|Ideas|Meetings|Projects",
    "tags": ["relevant", "tags"],
    "summary": "Updated 2-3 sentence summary",
    "calendar": [],
    "email": [],
    "reminders": []
  }}
}}

IMPORTANT:
- If appending, the narrative should seamlessly integrate the new content
- If resynthesizing, create a completely fresh narrative from all information
- Always return the COMPLETE narrative, not just changes
- Only extract Calendar, Email, and Reminder actions - nothing else"""

        response = self.client.chat.completions.create(
            model=self.MODEL,
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.choices[0].message.content.strip()

        # Handle potential markdown code blocks
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()

        try:
            data = json.loads(response_text)
            return {
                "decision": data.get("decision", {
                    "update_type": "append",
                    "confidence": 0.5,
                    "reason": "Default decision"
                }),
                "result": data.get("result", {
                    "narrative": existing_narrative + "\n\n" + new_content,
                    "title": existing_title,
                    "folder": "Personal",
                    "tags": [],
                    "summary": existing_summary,
                    "calendar": [],
                    "email": [],
                    "reminders": [],
                    "next_steps": []
                })
            }
        except json.JSONDecodeError:
            # Fallback: just append
            return {
                "decision": {
                    "update_type": "append",
                    "confidence": 0.5,
                    "reason": "JSON parse failed, defaulting to append"
                },
                "result": {
                    "narrative": existing_narrative + "\n\n" + new_content,
                    "title": existing_title,
                    "folder": "Personal",
                    "tags": [],
                    "summary": existing_summary,
                    "calendar": [],
                    "email": [],
                    "reminders": [],
                    "next_steps": []
                }
            }

    def _mock_smart_synthesis(
        self,
        new_content: str,
        existing_narrative: str,
        existing_title: str,
        input_history: list
    ) -> dict:
        """Mock smart synthesis for local dev (no API key)."""
        # Simple heuristic: if new content is short, append; otherwise resynthesize
        if len(new_content.split()) < 50:
            return {
                "decision": {
                    "update_type": "append",
                    "confidence": 0.7,
                    "reason": "New content is short, appending to existing"
                },
                "result": {
                    "narrative": existing_narrative + "\n\n" + new_content,
                    "title": existing_title,
                    "folder": "Personal",
                    "tags": [],
                    "summary": None,
                    "calendar": [],
                    "email": [],
                    "reminders": [],
                    "next_steps": []
                }
            }
        else:
            # Combine all content for mock resynthesize
            all_content = "\n\n".join([
                entry.get("content", "") for entry in input_history
            ])
            return {
                "decision": {
                    "update_type": "resynthesize",
                    "confidence": 0.7,
                    "reason": "Substantial new content, resynthesizing"
                },
                "result": {
                    "narrative": all_content,
                    "title": existing_title,
                    "folder": "Personal",
                    "tags": [],
                    "summary": None,
                    "calendar": [],
                    "email": [],
                    "reminders": [],
                    "next_steps": []
                }
            }

    async def summarize_note(self, transcript: str, duration_seconds: int = 0) -> str:
        """
        Generate a concise summary of a note.

        Args:
            transcript: The full transcript
            duration_seconds: Optional duration of the recording for length scaling

        Returns:
            Summary string
        """
        # Return mock response when API key not configured
        if not self.client:
            return transcript[:200] + ("..." if len(transcript) > 200 else "")

        # Determine expected length based on duration
        if duration_seconds < 60:
            length_guidance = "3-5 sentences capturing the complete thought."
        elif duration_seconds < 300:
            length_guidance = "2-3 substantial paragraphs preserving the full reasoning and context."
        else:
            length_guidance = "4-6 paragraphs with natural sections. Capture everything important—this is a longer note and deserves a comprehensive summary."

        prompt = f"""This is YOUR note—write a refined, well-structured version of your own thinking.

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
{length_guidance}

Return only the formatted note text (with markdown headers/bullets as appropriate for the type)."""

        response = self.client.chat.completions.create(
            model=self.MODEL,
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        return response.choices[0].message.content.strip()
