"""Voice processing router - the core of Glide."""
from datetime import datetime
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.note import Note, Folder
from app.models.action import Action, ActionType, ActionStatus, ActionPriority
from app.routers.auth import get_current_user
from app.services.transcription import TranscriptionService
from app.services.llm import LLMService
from app.services.storage import StorageService
from app.schemas.voice_schemas import VoiceProcessingResponse, ActionExtractionResult

router = APIRouter()


@router.post("/process", response_model=VoiceProcessingResponse)
async def process_voice_memo(
    current_user: Annotated[User, Depends(get_current_user)],
    audio_file: UploadFile = File(...),
    folder_id: Optional[UUID] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Process a voice memo:
    1. Upload audio to storage
    2. Transcribe using Whisper
    3. Extract actions using Claude
    4. Create note and actions in database
    5. Return structured response
    """
    # Validate file type
    allowed_types = ["audio/mpeg", "audio/mp3", "audio/m4a", "audio/wav", "audio/x-m4a", "audio/mp4"]
    if audio_file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid audio format. Allowed: mp3, m4a, wav"
        )

    try:
        # 1. Upload audio to storage
        storage_service = StorageService()
        audio_file.file.seek(0)
        upload_result = await storage_service.upload_audio(
            file=audio_file.file,
            user_id=str(current_user.id),
            filename=audio_file.filename or "recording.mp3",
            content_type=audio_file.content_type,
        )

        # 2. Transcribe audio
        transcription_service = TranscriptionService()
        audio_file.file.seek(0)
        transcription = await transcription_service.transcribe(
            audio_file=audio_file.file,
            filename=audio_file.filename or "recording.mp3",
        )

        # 3. Extract actions using LLM
        llm_service = LLMService()
        user_context = {
            "timezone": current_user.timezone,
            "current_date": datetime.utcnow().strftime("%Y-%m-%d"),
        }
        extraction = await llm_service.extract_actions(
            transcript=transcription.text,
            user_context=user_context,
        )

        # 4. Find or create folder
        folder_name = extraction.folder
        if folder_id:
            # Use specified folder
            result = await db.execute(
                select(Folder)
                .where(Folder.id == folder_id)
                .where(Folder.user_id == current_user.id)
            )
            folder = result.scalar_one_or_none()
            if folder:
                folder_name = folder.name
        else:
            # Find or create folder based on AI suggestion
            result = await db.execute(
                select(Folder)
                .where(Folder.user_id == current_user.id)
                .where(Folder.name == extraction.folder)
            )
            folder = result.scalar_one_or_none()

            if not folder:
                # Create the folder
                folder = Folder(
                    user_id=current_user.id,
                    name=extraction.folder,
                    icon="folder.fill",
                )
                db.add(folder)
                await db.flush()

            folder_id = folder.id

        # 5. Create note
        note = Note(
            user_id=current_user.id,
            folder_id=folder_id,
            title=extraction.title,
            transcript=transcription.text,
            summary=extraction.summary,
            duration=transcription.duration,
            audio_url=upload_result.get("key"),
            tags=extraction.tags,
            ai_processed=True,
            ai_metadata={
                "language": transcription.language,
                "extraction_model": "claude-sonnet-4-20250514",
            },
        )
        db.add(note)
        await db.flush()

        # 6. Create actions
        actions_created = []

        # Calendar events
        for cal_action in extraction.calendar:
            action = Action(
                note_id=note.id,
                action_type=ActionType.CALENDAR,
                status=ActionStatus.PENDING,
                title=cal_action.title,
                scheduled_date=_parse_datetime(cal_action.date, cal_action.time),
                location=cal_action.location,
                attendees=cal_action.attendees,
                details={"original": cal_action.model_dump()},
            )
            db.add(action)
            actions_created.append(action)

        # Email drafts
        for email_action in extraction.email:
            action = Action(
                note_id=note.id,
                action_type=ActionType.EMAIL,
                status=ActionStatus.PENDING,
                title=f"Email to {email_action.to}",
                email_to=email_action.to,
                email_subject=email_action.subject,
                email_body=email_action.body,
                details={"original": email_action.model_dump()},
            )
            db.add(action)
            actions_created.append(action)

        # Reminders
        for reminder in extraction.reminders:
            priority = ActionPriority.MEDIUM
            if reminder.priority == "high":
                priority = ActionPriority.HIGH
            elif reminder.priority == "low":
                priority = ActionPriority.LOW

            action = Action(
                note_id=note.id,
                action_type=ActionType.REMINDER,
                status=ActionStatus.PENDING,
                priority=priority,
                title=reminder.title,
                scheduled_date=_parse_datetime(reminder.due_date, reminder.due_time),
                details={"original": reminder.model_dump()},
            )
            db.add(action)
            actions_created.append(action)

        # Next steps
        for step in extraction.next_steps:
            action = Action(
                note_id=note.id,
                action_type=ActionType.NEXT_STEP,
                status=ActionStatus.PENDING,
                title=step,
            )
            db.add(action)
            actions_created.append(action)

        await db.commit()
        await db.refresh(note)

        # 7. Return response
        return VoiceProcessingResponse(
            note_id=note.id,
            title=note.title,
            transcript=note.transcript,
            summary=note.summary,
            duration=note.duration or 0,
            folder_id=folder_id,
            folder_name=folder_name,
            tags=note.tags or [],
            actions=extraction,
            created_at=note.created_at,
        )

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process voice memo: {str(e)}"
        )


@router.post("/append/{note_id}", response_model=VoiceProcessingResponse)
async def append_to_note(
    note_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    audio_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Append new audio recording to an existing note:
    1. Verify note exists and belongs to user
    2. Upload audio to storage
    3. Transcribe using Whisper
    4. Extract ONLY NEW actions using Claude (context-aware)
    5. Append transcript with timestamp separator
    6. Create new Action records
    7. Return updated note data
    """
    # Validate file type
    allowed_types = ["audio/mpeg", "audio/mp3", "audio/m4a", "audio/wav", "audio/x-m4a", "audio/mp4"]
    if audio_file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid audio format. Allowed: mp3, m4a, wav"
        )

    # 1. Verify note exists and belongs to user
    result = await db.execute(
        select(Note).where(Note.id == note_id).where(Note.user_id == current_user.id)
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )

    try:
        # 2. Upload audio to storage
        storage_service = StorageService()
        audio_file.file.seek(0)
        upload_result = await storage_service.upload_audio(
            file=audio_file.file,
            user_id=str(current_user.id),
            filename=audio_file.filename or "recording_append.mp3",
            content_type=audio_file.content_type,
        )

        # 3. Transcribe new audio
        transcription_service = TranscriptionService()
        audio_file.file.seek(0)
        transcription = await transcription_service.transcribe(
            audio_file=audio_file.file,
            filename=audio_file.filename or "recording_append.mp3",
        )

        # 4. Extract ONLY NEW actions using context-aware LLM method
        llm_service = LLMService()
        user_context = {
            "timezone": current_user.timezone,
            "current_date": datetime.utcnow().strftime("%Y-%m-%d"),
        }
        extraction = await llm_service.extract_actions_for_append(
            new_transcript=transcription.text,
            existing_transcript=note.transcript or "",
            existing_title=note.title,
            user_context=user_context,
        )

        # 5. Append transcript with timestamp separator
        timestamp = datetime.utcnow().strftime("%b %d, %Y at %I:%M %p")
        separator = f"\n\n--- Added on {timestamp} ---\n\n"
        updated_transcript = (note.transcript or "") + separator + transcription.text

        # Update note
        note.transcript = updated_transcript
        note.duration = (note.duration or 0) + transcription.duration

        # Add any new tags (merge with existing, avoid duplicates)
        existing_tags = set(note.tags or [])
        new_tags = set(extraction.tags or [])
        note.tags = list(existing_tags | new_tags)[:10]  # Limit to 10 total tags

        # Update ai_metadata to track append
        ai_metadata = note.ai_metadata or {}
        appends = ai_metadata.get("appends", [])
        appends.append({
            "timestamp": timestamp,
            "duration": transcription.duration,
            "audio_key": upload_result.get("key"),
        })
        ai_metadata["appends"] = appends
        note.ai_metadata = ai_metadata

        # 6. Create new Action records
        actions_created = []

        # Calendar events
        for cal_action in extraction.calendar:
            action = Action(
                note_id=note.id,
                action_type=ActionType.CALENDAR,
                status=ActionStatus.PENDING,
                title=cal_action.title,
                scheduled_date=_parse_datetime(cal_action.date, cal_action.time),
                location=cal_action.location,
                attendees=cal_action.attendees,
                details={"original": cal_action.model_dump(), "from_append": True},
            )
            db.add(action)
            actions_created.append(action)

        # Email drafts
        for email_action in extraction.email:
            action = Action(
                note_id=note.id,
                action_type=ActionType.EMAIL,
                status=ActionStatus.PENDING,
                title=f"Email to {email_action.to}",
                email_to=email_action.to,
                email_subject=email_action.subject,
                email_body=email_action.body,
                details={"original": email_action.model_dump(), "from_append": True},
            )
            db.add(action)
            actions_created.append(action)

        # Reminders
        for reminder in extraction.reminders:
            priority = ActionPriority.MEDIUM
            if reminder.priority == "high":
                priority = ActionPriority.HIGH
            elif reminder.priority == "low":
                priority = ActionPriority.LOW

            action = Action(
                note_id=note.id,
                action_type=ActionType.REMINDER,
                status=ActionStatus.PENDING,
                priority=priority,
                title=reminder.title,
                scheduled_date=_parse_datetime(reminder.due_date, reminder.due_time),
                details={"original": reminder.model_dump(), "from_append": True},
            )
            db.add(action)
            actions_created.append(action)

        # Next steps
        for step in extraction.next_steps:
            action = Action(
                note_id=note.id,
                action_type=ActionType.NEXT_STEP,
                status=ActionStatus.PENDING,
                title=step,
                details={"from_append": True},
            )
            db.add(action)
            actions_created.append(action)

        await db.commit()
        await db.refresh(note)

        # Get folder name
        folder_name = "Personal"
        if note.folder_id:
            folder_result = await db.execute(
                select(Folder).where(Folder.id == note.folder_id)
            )
            folder = folder_result.scalar_one_or_none()
            if folder:
                folder_name = folder.name

        # 7. Return response
        return VoiceProcessingResponse(
            note_id=note.id,
            title=note.title,
            transcript=note.transcript,
            summary=extraction.summary or note.summary,
            duration=note.duration or 0,
            folder_id=note.folder_id,
            folder_name=folder_name,
            tags=note.tags or [],
            actions=extraction,
            created_at=note.created_at,
        )

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to append to note: {str(e)}"
        )


@router.post("/transcribe")
async def transcribe_only(
    current_user: Annotated[User, Depends(get_current_user)],
    audio_file: UploadFile = File(...),
):
    """
    Transcribe audio without creating a note (for preview).
    """
    allowed_types = ["audio/mpeg", "audio/mp3", "audio/m4a", "audio/wav", "audio/x-m4a", "audio/mp4"]
    if audio_file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid audio format"
        )

    try:
        transcription_service = TranscriptionService()
        audio_file.file.seek(0)
        result = await transcription_service.transcribe(
            audio_file=audio_file.file,
            filename=audio_file.filename or "recording.mp3",
        )

        return {
            "text": result.text,
            "language": result.language,
            "duration": result.duration,
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}"
        )


@router.post("/analyze")
async def analyze_transcript(
    current_user: Annotated[User, Depends(get_current_user)],
    transcript: str = Form(...),
):
    """
    Analyze a transcript and extract actions (for preview/re-analysis).
    """
    try:
        llm_service = LLMService()
        user_context = {
            "timezone": current_user.timezone,
            "current_date": datetime.utcnow().strftime("%Y-%m-%d"),
        }

        extraction = await llm_service.extract_actions(
            transcript=transcript,
            user_context=user_context,
        )

        return extraction

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


@router.get("/upload-url")
async def get_upload_url(
    current_user: Annotated[User, Depends(get_current_user)],
    filename: str,
    content_type: str = "audio/mpeg",
):
    """
    Get a presigned URL for direct upload from mobile app.
    """
    try:
        storage_service = StorageService()
        result = await storage_service.get_upload_url(
            user_id=str(current_user.id),
            filename=filename,
            content_type=content_type,
        )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate upload URL: {str(e)}"
        )


def _parse_datetime(date_str: str, time_str: Optional[str] = None) -> datetime:
    """Parse date and optional time strings into datetime."""
    try:
        if time_str:
            return datetime.fromisoformat(f"{date_str}T{time_str}")
        return datetime.fromisoformat(f"{date_str}T09:00:00")
    except ValueError:
        # Fallback: try to parse just the date
        try:
            return datetime.fromisoformat(date_str)
        except ValueError:
            return datetime.utcnow()
