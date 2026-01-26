"""LLM service using Anthropic Claude for action extraction."""
import json
from typing import Optional
from anthropic import Anthropic

from app.config import get_settings
from app.schemas.voice_schemas import ActionExtractionResult


class LLMService:
    """Service for AI-powered action extraction using Claude."""

    def __init__(self):
        settings = get_settings()
        self.client = Anthropic(api_key=settings.anthropic_api_key)

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
        prompt = f"""Summarize this voice memo in 2-3 sentences, focusing on key points and action items:

{transcript}

Return only the summary text, no formatting."""

        response = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )

        return response.content[0].text.strip()
