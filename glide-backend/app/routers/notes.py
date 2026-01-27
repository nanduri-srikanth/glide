"""Notes CRUD router."""
from datetime import datetime
from typing import Annotated, Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.note import Note, Folder
from app.models.action import Action, ActionType
from app.routers.auth import get_current_user
from app.schemas.note_schemas import (
    NoteCreate,
    NoteUpdate,
    NoteResponse,
    NoteListItem,
    NoteListResponse,
)

router = APIRouter()


@router.get("", response_model=NoteListResponse)
async def list_notes(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    folder_id: Optional[UUID] = None,
    q: Optional[str] = None,
    tags: Optional[List[str]] = Query(None),
    is_pinned: Optional[bool] = None,
    is_archived: Optional[bool] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """List all notes with filtering and pagination."""
    # Base query
    query = (
        select(Note)
        .where(Note.user_id == current_user.id)
        .where(Note.is_deleted == False)
    )

    # Apply filters
    if folder_id:
        query = query.where(Note.folder_id == folder_id)

    if q:
        search_term = f"%{q}%"
        query = query.where(
            or_(
                Note.title.ilike(search_term),
                Note.transcript.ilike(search_term),
            )
        )

    if tags:
        query = query.where(Note.tags.overlap(tags))

    if is_pinned is not None:
        query = query.where(Note.is_pinned == is_pinned)

    if is_archived is not None:
        query = query.where(Note.is_archived == is_archived)
    else:
        # Default: don't show archived
        query = query.where(Note.is_archived == False)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination and ordering
    query = (
        query
        .options(selectinload(Note.actions))
        .order_by(Note.is_pinned.desc(), Note.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )

    result = await db.execute(query)
    notes = result.scalars().all()

    # Transform to list items
    items = []
    for note in notes:
        # Count actions by type
        calendar_count = sum(1 for a in note.actions if a.action_type == ActionType.CALENDAR)
        email_count = sum(1 for a in note.actions if a.action_type == ActionType.EMAIL)
        reminder_count = sum(1 for a in note.actions if a.action_type == ActionType.REMINDER)

        items.append(NoteListItem(
            id=note.id,
            title=note.title,
            preview=note.transcript[:100] + "..." if len(note.transcript) > 100 else note.transcript,
            duration=note.duration,
            folder_id=note.folder_id,
            tags=note.tags or [],
            is_pinned=note.is_pinned,
            action_count=len(note.actions),
            calendar_count=calendar_count,
            email_count=email_count,
            reminder_count=reminder_count,
            created_at=note.created_at,
        ))

    return NoteListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page,
    )


@router.get("/search", response_model=NoteListResponse)
async def search_notes(
    q: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Full-text search notes."""
    search_term = f"%{q}%"

    query = (
        select(Note)
        .where(Note.user_id == current_user.id)
        .where(Note.is_deleted == False)
        .where(
            or_(
                Note.title.ilike(search_term),
                Note.transcript.ilike(search_term),
                Note.tags.overlap([q]),
            )
        )
    )

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    query = (
        query
        .options(selectinload(Note.actions))
        .order_by(Note.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )

    result = await db.execute(query)
    notes = result.scalars().all()

    items = [
        NoteListItem(
            id=note.id,
            title=note.title,
            preview=note.transcript[:100] if note.transcript else "",
            duration=note.duration,
            folder_id=note.folder_id,
            tags=note.tags or [],
            is_pinned=note.is_pinned,
            action_count=len(note.actions),
            calendar_count=sum(1 for a in note.actions if a.action_type == ActionType.CALENDAR),
            email_count=sum(1 for a in note.actions if a.action_type == ActionType.EMAIL),
            reminder_count=sum(1 for a in note.actions if a.action_type == ActionType.REMINDER),
            created_at=note.created_at,
        )
        for note in notes
    ]

    return NoteListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page,
    )


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get a single note by ID."""
    result = await db.execute(
        select(Note)
        .options(selectinload(Note.actions), selectinload(Note.folder))
        .where(Note.id == note_id)
        .where(Note.user_id == current_user.id)
        .where(Note.is_deleted == False)
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )

    response = NoteResponse.model_validate(note)
    if note.folder:
        response.folder_name = note.folder.name

    return response


@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    note_data: NoteCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Create a new note manually (non-voice)."""
    # Verify folder exists if provided
    if note_data.folder_id:
        result = await db.execute(
            select(Folder)
            .where(Folder.id == note_data.folder_id)
            .where(Folder.user_id == current_user.id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )

    note = Note(
        user_id=current_user.id,
        title=note_data.title,
        transcript=note_data.transcript,
        folder_id=note_data.folder_id,
        tags=note_data.tags,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return note


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: UUID,
    note_data: NoteUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Update a note."""
    result = await db.execute(
        select(Note)
        .options(selectinload(Note.actions))
        .where(Note.id == note_id)
        .where(Note.user_id == current_user.id)
        .where(Note.is_deleted == False)
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )

    # Verify folder exists if changing
    if note_data.folder_id:
        result = await db.execute(
            select(Folder)
            .where(Folder.id == note_data.folder_id)
            .where(Folder.user_id == current_user.id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Folder not found"
            )

    update_data = note_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(note, field, value)

    note.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(note)

    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    permanent: bool = False,
):
    """Delete a note (soft delete by default)."""
    result = await db.execute(
        select(Note)
        .where(Note.id == note_id)
        .where(Note.user_id == current_user.id)
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )

    if permanent:
        await db.delete(note)
    else:
        note.is_deleted = True
        note.deleted_at = datetime.utcnow()

    await db.commit()


@router.post("/{note_id}/restore", response_model=NoteResponse)
async def restore_note(
    note_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Restore a deleted note."""
    result = await db.execute(
        select(Note)
        .where(Note.id == note_id)
        .where(Note.user_id == current_user.id)
        .where(Note.is_deleted == True)
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found in trash"
        )

    note.is_deleted = False
    note.deleted_at = None
    note.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(note)

    return note
