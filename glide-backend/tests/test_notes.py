"""Comprehensive tests for notes router."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

from app.main import app
from app.database import Base, get_db


# Use SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_notes.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_database():
    """Create test database for each test."""
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    """Create authenticated user and return headers."""
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"

    # Register
    client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "testpassword123",
        },
    )

    # Login
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": email,
            "password": "testpassword123",
        },
    )
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_note(client, auth_headers):
    """Create a sample note and return its data."""
    response = client.post(
        "/api/v1/notes",
        headers=auth_headers,
        json={
            "title": "Sample Note",
            "transcript": "This is a sample transcript for testing.",
            "tags": ["test", "sample"],
        },
    )
    return response.json()


@pytest.fixture
def sample_folder(client, auth_headers):
    """Create a sample folder and return its data."""
    response = client.post(
        "/api/v1/folders",
        headers=auth_headers,
        json={
            "name": "Test Folder",
            "icon": "folder",
        },
    )
    return response.json()


class TestListNotes:
    """Tests for listing notes."""

    def test_list_notes_empty(self, client, auth_headers):
        """Test listing notes when empty."""
        response = client.get("/api/v1/notes", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["page"] == 1

    def test_list_notes_with_data(self, client, auth_headers, sample_note):
        """Test listing notes with data."""
        response = client.get("/api/v1/notes", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["title"] == "Sample Note"

    def test_list_notes_pagination(self, client, auth_headers):
        """Test notes pagination."""
        # Create multiple notes
        for i in range(25):
            client.post(
                "/api/v1/notes",
                headers=auth_headers,
                json={
                    "title": f"Note {i}",
                    "transcript": f"Content {i}",
                },
            )

        # First page
        response = client.get(
            "/api/v1/notes?page=1&per_page=10",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 10
        assert data["total"] == 25
        assert data["pages"] == 3

        # Second page
        response = client.get(
            "/api/v1/notes?page=2&per_page=10",
            headers=auth_headers,
        )
        assert len(response.json()["items"]) == 10

    def test_list_notes_filter_by_folder(self, client, auth_headers, sample_folder):
        """Test filtering notes by folder."""
        # Create note in folder
        client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={
                "title": "Folder Note",
                "transcript": "In folder",
                "folder_id": sample_folder["id"],
            },
        )

        # Create note without folder
        client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={
                "title": "No Folder Note",
                "transcript": "No folder",
            },
        )

        response = client.get(
            f"/api/v1/notes?folder_id={sample_folder['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["title"] == "Folder Note"

    def test_list_notes_filter_by_pinned(self, client, auth_headers):
        """Test filtering notes by pinned status."""
        # Create pinned note
        response = client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={
                "title": "Pinned Note",
                "transcript": "Pinned",
            },
        )
        note_id = response.json()["id"]

        # Pin the note
        client.patch(
            f"/api/v1/notes/{note_id}",
            headers=auth_headers,
            json={"is_pinned": True},
        )

        # Create unpinned note
        client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={
                "title": "Regular Note",
                "transcript": "Not pinned",
            },
        )

        response = client.get(
            "/api/v1/notes?is_pinned=true",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["title"] == "Pinned Note"

    def test_list_notes_search(self, client, auth_headers):
        """Test searching notes."""
        client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={
                "title": "Meeting Notes",
                "transcript": "Discussed quarterly goals",
            },
        )
        client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={
                "title": "Shopping List",
                "transcript": "Milk, eggs, bread",
            },
        )

        response = client.get(
            "/api/v1/notes?q=meeting",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert "Meeting" in data["items"][0]["title"]

    def test_list_notes_unauthenticated(self, client):
        """Test listing notes without authentication."""
        response = client.get("/api/v1/notes")
        assert response.status_code == 401


class TestGetNote:
    """Tests for getting a single note."""

    def test_get_note_success(self, client, auth_headers, sample_note):
        """Test getting a note by ID."""
        response = client.get(
            f"/api/v1/notes/{sample_note['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_note["id"]
        assert data["title"] == "Sample Note"
        assert data["transcript"] == "This is a sample transcript for testing."

    def test_get_note_not_found(self, client, auth_headers):
        """Test getting non-existent note."""
        fake_id = str(uuid.uuid4())
        response = client.get(
            f"/api/v1/notes/{fake_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_get_note_other_user(self, client, auth_headers, sample_note):
        """Test getting another user's note."""
        # Create second user
        email = f"other_{uuid.uuid4().hex[:8]}@example.com"
        client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "password123"},
        )
        response = client.post(
            "/api/v1/auth/login",
            data={"username": email, "password": "password123"},
        )
        other_headers = {"Authorization": f"Bearer {response.json()['access_token']}"}

        # Try to access first user's note
        response = client.get(
            f"/api/v1/notes/{sample_note['id']}",
            headers=other_headers,
        )
        assert response.status_code == 404


class TestCreateNote:
    """Tests for creating notes."""

    def test_create_note_success(self, client, auth_headers):
        """Test creating a note."""
        response = client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={
                "title": "New Note",
                "transcript": "Note content here.",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "New Note"
        assert data["transcript"] == "Note content here."
        assert "id" in data
        assert "created_at" in data

    def test_create_note_with_folder(self, client, auth_headers, sample_folder):
        """Test creating note in a folder."""
        response = client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={
                "title": "Folder Note",
                "transcript": "Content",
                "folder_id": sample_folder["id"],
            },
        )
        assert response.status_code == 201
        assert response.json()["folder_id"] == sample_folder["id"]

    def test_create_note_with_tags(self, client, auth_headers):
        """Test creating note with tags."""
        response = client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={
                "title": "Tagged Note",
                "transcript": "Content",
                "tags": ["important", "work", "meeting"],
            },
        )
        assert response.status_code == 201
        assert response.json()["tags"] == ["important", "work", "meeting"]

    def test_create_note_invalid_folder(self, client, auth_headers):
        """Test creating note with non-existent folder."""
        fake_folder_id = str(uuid.uuid4())
        response = client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={
                "title": "Bad Note",
                "transcript": "Content",
                "folder_id": fake_folder_id,
            },
        )
        assert response.status_code == 404

    def test_create_note_missing_required_fields(self, client, auth_headers):
        """Test creating note without required fields."""
        response = client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={},
        )
        assert response.status_code == 422


class TestUpdateNote:
    """Tests for updating notes."""

    def test_update_title(self, client, auth_headers, sample_note):
        """Test updating note title."""
        response = client.patch(
            f"/api/v1/notes/{sample_note['id']}",
            headers=auth_headers,
            json={"title": "Updated Title"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"

    def test_update_transcript(self, client, auth_headers, sample_note):
        """Test updating note transcript."""
        response = client.patch(
            f"/api/v1/notes/{sample_note['id']}",
            headers=auth_headers,
            json={"transcript": "Updated transcript content."},
        )
        assert response.status_code == 200
        assert response.json()["transcript"] == "Updated transcript content."

    def test_update_pin_status(self, client, auth_headers, sample_note):
        """Test pinning and unpinning note."""
        # Pin
        response = client.patch(
            f"/api/v1/notes/{sample_note['id']}",
            headers=auth_headers,
            json={"is_pinned": True},
        )
        assert response.status_code == 200
        assert response.json()["is_pinned"] is True

        # Unpin
        response = client.patch(
            f"/api/v1/notes/{sample_note['id']}",
            headers=auth_headers,
            json={"is_pinned": False},
        )
        assert response.json()["is_pinned"] is False

    def test_update_archive_status(self, client, auth_headers, sample_note):
        """Test archiving and unarchiving note."""
        response = client.patch(
            f"/api/v1/notes/{sample_note['id']}",
            headers=auth_headers,
            json={"is_archived": True},
        )
        assert response.status_code == 200
        assert response.json()["is_archived"] is True

    def test_update_tags(self, client, auth_headers, sample_note):
        """Test updating note tags."""
        response = client.patch(
            f"/api/v1/notes/{sample_note['id']}",
            headers=auth_headers,
            json={"tags": ["new-tag", "another-tag"]},
        )
        assert response.status_code == 200
        assert response.json()["tags"] == ["new-tag", "another-tag"]

    def test_update_move_to_folder(self, client, auth_headers, sample_note, sample_folder):
        """Test moving note to a folder."""
        response = client.patch(
            f"/api/v1/notes/{sample_note['id']}",
            headers=auth_headers,
            json={"folder_id": sample_folder["id"]},
        )
        assert response.status_code == 200
        assert response.json()["folder_id"] == sample_folder["id"]

    def test_update_not_found(self, client, auth_headers):
        """Test updating non-existent note."""
        fake_id = str(uuid.uuid4())
        response = client.patch(
            f"/api/v1/notes/{fake_id}",
            headers=auth_headers,
            json={"title": "Updated"},
        )
        assert response.status_code == 404


class TestDeleteNote:
    """Tests for deleting notes."""

    def test_soft_delete(self, client, auth_headers, sample_note):
        """Test soft deleting a note."""
        response = client.delete(
            f"/api/v1/notes/{sample_note['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        # Note should not appear in list
        response = client.get("/api/v1/notes", headers=auth_headers)
        assert len(response.json()["items"]) == 0

        # Note should not be found by ID
        response = client.get(
            f"/api/v1/notes/{sample_note['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_permanent_delete(self, client, auth_headers, sample_note):
        """Test permanently deleting a note."""
        response = client.delete(
            f"/api/v1/notes/{sample_note['id']}?permanent=true",
            headers=auth_headers,
        )
        assert response.status_code == 204

    def test_delete_not_found(self, client, auth_headers):
        """Test deleting non-existent note."""
        fake_id = str(uuid.uuid4())
        response = client.delete(
            f"/api/v1/notes/{fake_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestRestoreNote:
    """Tests for restoring deleted notes."""

    def test_restore_deleted_note(self, client, auth_headers, sample_note):
        """Test restoring a soft-deleted note."""
        # Delete the note
        client.delete(
            f"/api/v1/notes/{sample_note['id']}",
            headers=auth_headers,
        )

        # Restore the note
        response = client.post(
            f"/api/v1/notes/{sample_note['id']}/restore",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Sample Note"

        # Note should now be accessible
        response = client.get(
            f"/api/v1/notes/{sample_note['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_restore_non_deleted_note(self, client, auth_headers, sample_note):
        """Test restoring a note that is not deleted."""
        response = client.post(
            f"/api/v1/notes/{sample_note['id']}/restore",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestSearchNotes:
    """Tests for note search endpoint."""

    def test_search_by_title(self, client, auth_headers):
        """Test searching notes by title."""
        client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={"title": "Python Tutorial", "transcript": "Learning Python basics"},
        )
        client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={"title": "JavaScript Guide", "transcript": "JS fundamentals"},
        )

        response = client.get(
            "/api/v1/notes/search?q=Python",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert "Python" in data["items"][0]["title"]

    def test_search_by_transcript(self, client, auth_headers):
        """Test searching notes by transcript content."""
        client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={"title": "Meeting", "transcript": "Discuss quarterly budget"},
        )

        response = client.get(
            "/api/v1/notes/search?q=budget",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert len(response.json()["items"]) == 1

    def test_search_case_insensitive(self, client, auth_headers):
        """Test that search is case insensitive."""
        client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={"title": "IMPORTANT Meeting", "transcript": "Very important"},
        )

        response = client.get(
            "/api/v1/notes/search?q=important",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert len(response.json()["items"]) == 1

    def test_search_no_results(self, client, auth_headers, sample_note):
        """Test search with no matching results."""
        response = client.get(
            "/api/v1/notes/search?q=nonexistent",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert len(response.json()["items"]) == 0
