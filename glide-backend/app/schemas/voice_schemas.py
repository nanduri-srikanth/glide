"""Voice processing Pydantic schemas."""
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel


class TranscriptionResult(BaseModel):
    """Schema for transcription result."""
    text: str
    language: str
    duration: int  # in seconds
    confidence: Optional[float] = None


class CalendarActionExtracted(BaseModel):
    """Schema for calendar action extracted by AI."""
    title: str
    date: str  # ISO format
    time: Optional[str] = None
    location: Optional[str] = None
    attendees: List[str] = []


class EmailActionExtracted(BaseModel):
    """Schema for email action extracted by AI."""
    to: str
    subject: str
    body: str


class ReminderActionExtracted(BaseModel):
    """Schema for reminder action extracted by AI."""
    title: str
    due_date: str  # ISO format
    due_time: Optional[str] = None
    priority: str = "medium"


class ActionExtractionResult(BaseModel):
    """Schema for AI action extraction result."""
    title: str
    folder: str
    tags: List[str]
    summary: Optional[str] = None
    calendar: List[CalendarActionExtracted] = []
    email: List[EmailActionExtracted] = []
    reminders: List[ReminderActionExtracted] = []
    next_steps: List[str] = []


class VoiceProcessingResponse(BaseModel):
    """Schema for voice processing response."""
    note_id: UUID
    title: str
    transcript: str
    summary: Optional[str]
    duration: int
    folder_id: Optional[UUID]
    folder_name: str
    tags: List[str]
    actions: ActionExtractionResult
    created_at: datetime


class ProcessingStatus(BaseModel):
    """Schema for processing status updates."""
    note_id: UUID
    status: str  # "uploading", "transcribing", "analyzing", "creating_actions", "complete"
    progress: int  # 0-100
    message: str


class InputHistoryEntry(BaseModel):
    """Schema for tracking individual input additions."""
    type: str  # "text" or "audio"
    content: str  # The raw text or transcription
    timestamp: datetime
    duration: Optional[int] = None  # Audio duration in seconds, if applicable
    audio_key: Optional[str] = None  # Storage key for audio file, if applicable


class SynthesisResult(BaseModel):
    """Schema for content synthesis result."""
    narrative: str  # The synthesized cohesive narrative
    title: str
    folder: str
    tags: List[str]
    summary: Optional[str] = None
    calendar: List[CalendarActionExtracted] = []
    email: List[EmailActionExtracted] = []
    reminders: List[ReminderActionExtracted] = []
    next_steps: List[str] = []


class SynthesisResponse(BaseModel):
    """Schema for synthesis endpoint response."""
    note_id: UUID
    title: str
    narrative: str  # The synthesized content
    raw_inputs: List[InputHistoryEntry]  # History of all inputs
    summary: Optional[str]
    duration: int  # Total audio duration
    folder_id: Optional[UUID]
    folder_name: str
    tags: List[str]
    actions: ActionExtractionResult
    created_at: datetime
    updated_at: datetime


class UpdateDecision(BaseModel):
    """Schema for smart synthesis decision."""
    update_type: str  # "append" | "resynthesize"
    confidence: float  # 0.0-1.0
    reason: str  # Explanation for the decision


class SmartSynthesisResponse(SynthesisResponse):
    """Schema for smart synthesis endpoint response with decision info."""
    decision: Optional[UpdateDecision] = None
