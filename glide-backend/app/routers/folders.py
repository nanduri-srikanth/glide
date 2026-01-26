"""Folders router."""
from datetime import datetime
from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.note import Note, Folder
from app.routers.auth import get_current_user
from app.schemas.note_schemas import FolderCreate, FolderUpdate, FolderResponse

router = APIRouter()


@router.get("", response_model=List[FolderResponse])
async def list_folders(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """List all folders with note counts."""
    # Get folders
    result = await db.execute(
        select(Folder)
        .where(Folder.user_id == current_user.id)
        .order_by(Folder.sort_order, Folder.name)
    )
    folders = result.scalars().all()

    # Get note counts per folder
    count_result = await db.execute(
        select(Note.folder_id, func.count(Note.id))
        .where(Note.user_id == current_user.id)
        .where(Note.is_deleted == False)
        .group_by(Note.folder_id)
    )
    counts = dict(count_result.all())

    # Build response with counts
    response = []
    for folder in folders:
        folder_response = FolderResponse.model_validate(folder)
        folder_response.note_count = counts.get(folder.id, 0)
        response.append(folder_response)

    return response


@router.get("/{folder_id}", response_model=FolderResponse)
async def get_folder(
    folder_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get a single folder."""
    result = await db.execute(
        select(Folder)
        .where(Folder.id == folder_id)
        .where(Folder.user_id == current_user.id)
    )
    folder = result.scalar_one_or_none()

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )

    # Get note count
    count_result = await db.execute(
        select(func.count(Note.id))
        .where(Note.folder_id == folder_id)
        .where(Note.is_deleted == False)
    )
    note_count = count_result.scalar() or 0

    response = FolderResponse.model_validate(folder)
    response.note_count = note_count
    return response


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    folder_data: FolderCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Create a new folder."""
    # Check for duplicate name
    result = await db.execute(
        select(Folder)
        .where(Folder.user_id == current_user.id)
        .where(Folder.name == folder_data.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Folder with this name already exists"
        )

    folder = Folder(
        user_id=current_user.id,
        name=folder_data.name,
        icon=folder_data.icon,
        color=folder_data.color,
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)

    response = FolderResponse.model_validate(folder)
    response.note_count = 0
    return response


@router.patch("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: UUID,
    folder_data: FolderUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Update a folder."""
    result = await db.execute(
        select(Folder)
        .where(Folder.id == folder_id)
        .where(Folder.user_id == current_user.id)
    )
    folder = result.scalar_one_or_none()

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )

    if folder.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify system folders"
        )

    # Check for duplicate name if changing
    if folder_data.name and folder_data.name != folder.name:
        result = await db.execute(
            select(Folder)
            .where(Folder.user_id == current_user.id)
            .where(Folder.name == folder_data.name)
            .where(Folder.id != folder_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Folder with this name already exists"
            )

    update_data = folder_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(folder, field, value)

    folder.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(folder)

    return FolderResponse.model_validate(folder)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    move_notes_to: UUID = None,
):
    """
    Delete a folder.
    Notes can be moved to another folder or will be unassigned.
    """
    result = await db.execute(
        select(Folder)
        .where(Folder.id == folder_id)
        .where(Folder.user_id == current_user.id)
    )
    folder = result.scalar_one_or_none()

    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Folder not found"
        )

    if folder.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete system folders"
        )

    # Move notes to another folder or unassign
    if move_notes_to:
        # Verify target folder exists
        result = await db.execute(
            select(Folder)
            .where(Folder.id == move_notes_to)
            .where(Folder.user_id == current_user.id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target folder not found"
            )

    # Update notes
    await db.execute(
        select(Note)
        .where(Note.folder_id == folder_id)
        .update({Note.folder_id: move_notes_to})
    )

    await db.delete(folder)
    await db.commit()


@router.post("/setup-defaults")
async def setup_default_folders(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Create default folders for a new user.
    Called during onboarding. Always ensures "All Notes" exists.
    """
    # Check if "All Notes" folder exists
    result = await db.execute(
        select(Folder)
        .where(Folder.user_id == current_user.id)
        .where(Folder.name == "All Notes")
    )
    all_notes_exists = result.scalar_one_or_none() is not None

    # Check total folder count
    count_result = await db.execute(
        select(func.count(Folder.id))
        .where(Folder.user_id == current_user.id)
    )
    count = count_result.scalar() or 0

    created = 0

    # Always ensure "All Notes" exists
    if not all_notes_exists:
        all_notes = Folder(
            user_id=current_user.id,
            name="All Notes",
            icon="folder",
            is_system=True,
            sort_order=0,
        )
        db.add(all_notes)
        created += 1

    # Only create other defaults if no folders exist
    if count == 0 or (count == 1 and not all_notes_exists):
        default_folders = [
            {"name": "Work", "icon": "briefcase", "sort_order": 1},
            {"name": "Personal", "icon": "person", "sort_order": 2},
            {"name": "Ideas", "icon": "lightbulb", "sort_order": 3},
        ]

        for folder_data in default_folders:
            folder = Folder(
                user_id=current_user.id,
                name=folder_data["name"],
                icon=folder_data["icon"],
                is_system=False,
                sort_order=folder_data["sort_order"],
            )
            db.add(folder)
            created += 1

    if created > 0:
        await db.commit()

    return {"message": f"Folders setup complete", "created": created}
