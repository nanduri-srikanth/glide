"""Transcription service using OpenAI Whisper API."""
import os
import tempfile
from typing import BinaryIO
import openai

from app.config import get_settings
from app.schemas.voice_schemas import TranscriptionResult
from app.utils.audio import get_audio_duration


class TranscriptionService:
    """Service for audio transcription using OpenAI Whisper."""

    def __init__(self):
        settings = get_settings()
        self.client = openai.OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    async def transcribe(self, audio_file: BinaryIO, filename: str) -> TranscriptionResult:
        """
        Transcribe audio file using Whisper API.

        Args:
            audio_file: Binary audio file
            filename: Original filename for format detection

        Returns:
            TranscriptionResult with text, language, and duration
        """
        # Save to temp file for processing
        suffix = os.path.splitext(filename)[1] or ".mp3"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            temp_file.write(audio_file.read())
            temp_path = temp_file.name

        try:
            # Get audio duration
            duration = get_audio_duration(temp_path)

            # If no OpenAI client, return mock transcription
            if not self.client:
                return TranscriptionResult(
                    text="[Transcription unavailable - OpenAI API key not configured]",
                    language="en",
                    duration=duration,
                    confidence=None,
                )

            # Transcribe using Whisper API
            with open(temp_path, "rb") as audio:
                response = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio,
                    response_format="verbose_json",
                )

            return TranscriptionResult(
                text=response.text,
                language=response.language or "en",
                duration=duration,
                confidence=None,  # Whisper doesn't provide confidence scores
            )

        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    async def transcribe_from_url(self, audio_url: str) -> TranscriptionResult:
        """
        Transcribe audio from a URL (e.g., S3).

        Args:
            audio_url: URL to the audio file

        Returns:
            TranscriptionResult
        """
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.get(audio_url)
            response.raise_for_status()

            # Save to temp file
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
                temp_file.write(response.content)
                temp_path = temp_file.name

        try:
            duration = get_audio_duration(temp_path)

            # If no OpenAI client, return mock transcription
            if not self.client:
                return TranscriptionResult(
                    text="[Transcription unavailable - OpenAI API key not configured]",
                    language="en",
                    duration=duration,
                )

            with open(temp_path, "rb") as audio:
                whisper_response = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio,
                    response_format="verbose_json",
                )

            return TranscriptionResult(
                text=whisper_response.text,
                language=whisper_response.language or "en",
                duration=duration,
            )
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
