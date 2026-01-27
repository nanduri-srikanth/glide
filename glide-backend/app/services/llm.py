"""LLM service using Anthropic Claude for action extraction."""
import json
from datetime import datetime
from typing import Optional

from app.config import get_settings
from app.schemas.voice_schemas import ActionExtractionResult


class LLMService:
    """Service for AI-powered action extraction using Claude."""

    def __init__(self):
        settings = get_settings()
        self.api_key = settings.anthropic_api_key
        self.client = None
        if self.api_key:
            from anthropic import Anthropic
            self.client = Anthropic(api_key=self.api_key)

    async def extract_actions(
        self,
        transcript: str,
        user_context: Optional[dict] = None
    ) -> ActionExtractionResult:
        """
        Analyze transcript and extract actionable items using Claude.

        Args:
            transcript: The transcribed text from voice memo
            user_context: Optional context about the user (timezone, preferences)

        Returns:
            ActionExtractionResult with structured actions
        """
        # Return mock response when API key not configured (local dev mode)
        if not self.client:
            return self._mock_extraction(transcript)

        context_str = ""
        if user_context:
            context_str = f"""
User context:
- Timezone: {user_context.get('timezone', 'America/Chicago')}
- Current date: {user_context.get('current_date', 'today')}
"""

        prompt = f"""Analyze this voice memo transcript and extract actionable items.

Transcript:
{transcript}

{context_str}

Extract and return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{{
  "title": "Brief descriptive title for this note (5-10 words max)",
  "folder": "Work|Personal|Ideas|Meetings|Projects",
  "tags": ["relevant", "tags", "max5"],
  "summary": "2-3 sentence summary of the key points",
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
      "body": "Draft email body content"
    }}
  ],
  "reminders": [
    {{
      "title": "Reminder text",
      "due_date": "YYYY-MM-DD",
      "due_time": "HH:MM (optional)",
      "priority": "low|medium|high"
    }}
  ],
  "next_steps": [
    "Action item 1",
    "Action item 2"
  ]
}}

Rules:
1. Only include actions that are explicitly mentioned or strongly implied
2. Use realistic dates based on context (if "next Tuesday" is mentioned, calculate the actual date)
3. For emails, draft professional content based on the context
4. Categorize into the most appropriate folder
5. Extract 2-5 relevant tags
6. If no actions of a type are found, use empty array []
7. Return ONLY the JSON object, nothing else"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        # Parse JSON response
        response_text = response.content[0].text.strip()

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
            next_steps=data.get("next_steps", []),
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
      "to": "email@example.com",
      "subject": "NEW Email subject",
      "body": "Draft email body"
    }}
  ],
  "reminders": [
    {{
      "title": "NEW Reminder text",
      "due_date": "YYYY-MM-DD",
      "due_time": "HH:MM (optional)",
      "priority": "low|medium|high"
    }}
  ],
  "next_steps": [
    "NEW action item 1",
    "NEW action item 2"
  ]
}}

Rules:
1. ONLY include actions explicitly mentioned in the NEW transcript
2. Do NOT duplicate any actions implied by the existing transcript
3. If no new actions are found, use empty arrays []
4. The title should remain the same as the existing title
5. Only add new tags that are relevant to the new content
6. Return ONLY the JSON object, nothing else"""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        # Parse JSON response
        response_text = response.content[0].text.strip()

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
            next_steps=data.get("next_steps", []),
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
                "body": f"[AI draft unavailable - connect Anthropic API]\n\nContext: {context[:200]}..."
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

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.content[0].text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()

        return json.loads(response_text)

    async def summarize_note(self, transcript: str) -> str:
        """
        Generate a concise summary of a note.

        Args:
            transcript: The full transcript

        Returns:
            Summary string
        """
        # Return mock response when API key not configured
        if not self.client:
            return transcript[:200] + ("..." if len(transcript) > 200 else "")

        prompt = f"""Summarize this voice memo in 2-3 sentences, focusing on key points and action items:

{transcript}

Return only the summary text, no formatting."""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )

        return response.content[0].text.strip()
