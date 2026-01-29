"""Comprehensive tests for folders router."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

from app.main import app
from app.database import Base, get_db


# Use SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_folders.db"
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

    client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "testpassword123",
        },
    )

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
def sample_folder(client, auth_headers):
    """Create a sample folder and return its data."""
    response = client.post(
        "/api/v1/folders",
        headers=auth_headers,
        json={
            "name": "Test Folder",
            "icon": "folder",
            "color": "#FF5733",
        },
    )
    return response.json()


class TestListFolders:
    """Tests for listing folders."""

    def test_list_folders_empty(self, client, auth_headers):
        """Test listing folders when empty."""
        response = client.get("/api/v1/folders", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_list_folders_with_data(self, client, auth_headers, sample_folder):
        """Test listing folders with data."""
        response = client.get("/api/v1/folders", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        folder_names = [f["name"] for f in data]
        assert "Test Folder" in folder_names

    def test_list_folders_hierarchical(self, client, auth_headers):
        """Test that folders are returned in hierarchical structure."""
        # Create parent folder
        parent_response = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={"name": "Parent Folder", "icon": "folder"},
        )
        parent_id = parent_response.json()["id"]

        # Create child folder
        client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={
                "name": "Child Folder",
                "icon": "folder",
                "parent_id": parent_id,
            },
        )

        response = client.get("/api/v1/folders", headers=auth_headers)
        data = response.json()

        # Find parent folder and check children
        parent = next((f for f in data if f["name"] == "Parent Folder"), None)
        assert parent is not None
        assert len(parent["children"]) == 1
        assert parent["children"][0]["name"] == "Child Folder"

    def test_list_folders_unauthenticated(self, client):
        """Test listing folders without authentication."""
        response = client.get("/api/v1/folders")
        assert response.status_code == 401


class TestGetFolder:
    """Tests for getting a single folder."""

    def test_get_folder_success(self, client, auth_headers, sample_folder):
        """Test getting a folder by ID."""
        response = client.get(
            f"/api/v1/folders/{sample_folder['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_folder["id"]
        assert data["name"] == "Test Folder"

    def test_get_folder_not_found(self, client, auth_headers):
        """Test getting non-existent folder."""
        fake_id = str(uuid.uuid4())
        response = client.get(
            f"/api/v1/folders/{fake_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_get_folder_with_note_count(self, client, auth_headers, sample_folder):
        """Test that folder includes accurate note count."""
        # Create notes in folder
        for i in range(3):
            client.post(
                "/api/v1/notes",
                headers=auth_headers,
                json={
                    "title": f"Note {i}",
                    "transcript": f"Content {i}",
                    "folder_id": sample_folder["id"],
                },
            )

        response = client.get(
            f"/api/v1/folders/{sample_folder['id']}",
            headers=auth_headers,
        )
        assert response.json()["note_count"] == 3


class TestCreateFolder:
    """Tests for creating folders."""

    def test_create_folder_success(self, client, auth_headers):
        """Test creating a folder."""
        response = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={
                "name": "New Folder",
                "icon": "star",
                "color": "#0066FF",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Folder"
        assert data["icon"] == "star"
        assert data["color"] == "#0066FF"
        assert data["is_system"] is False
        assert "id" in data

    def test_create_folder_minimal(self, client, auth_headers):
        """Test creating folder with minimal data."""
        response = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={"name": "Minimal Folder"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Minimal Folder"

    def test_create_nested_folder(self, client, auth_headers, sample_folder):
        """Test creating a nested folder."""
        response = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={
                "name": "Child Folder",
                "icon": "folder",
                "parent_id": sample_folder["id"],
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["parent_id"] == sample_folder["id"]
        assert data["depth"] == 1

    def test_create_folder_duplicate_name(self, client, auth_headers, sample_folder):
        """Test creating folder with duplicate name fails."""
        response = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={"name": "Test Folder"},  # Same name as sample_folder
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()

    def test_create_folder_max_depth(self, client, auth_headers):
        """Test that folder nesting is limited to depth 2."""
        # Create level 0
        level0 = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={"name": "Level 0"},
        ).json()

        # Create level 1
        level1 = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={"name": "Level 1", "parent_id": level0["id"]},
        ).json()

        # Create level 2
        level2 = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={"name": "Level 2", "parent_id": level1["id"]},
        ).json()

        # Try to create level 3 - should fail
        response = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={"name": "Level 3", "parent_id": level2["id"]},
        )
        assert response.status_code == 400
        assert "depth" in response.json()["detail"].lower()

    def test_create_folder_invalid_parent(self, client, auth_headers):
        """Test creating folder with non-existent parent."""
        fake_parent_id = str(uuid.uuid4())
        response = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={
                "name": "Orphan Folder",
                "parent_id": fake_parent_id,
            },
        )
        assert response.status_code == 404


class TestUpdateFolder:
    """Tests for updating folders."""

    def test_update_folder_name(self, client, auth_headers, sample_folder):
        """Test updating folder name."""
        response = client.patch(
            f"/api/v1/folders/{sample_folder['id']}",
            headers=auth_headers,
            json={"name": "Renamed Folder"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Renamed Folder"

    def test_update_folder_icon(self, client, auth_headers, sample_folder):
        """Test updating folder icon."""
        response = client.patch(
            f"/api/v1/folders/{sample_folder['id']}",
            headers=auth_headers,
            json={"icon": "briefcase"},
        )
        assert response.status_code == 200
        assert response.json()["icon"] == "briefcase"

    def test_update_folder_color(self, client, auth_headers, sample_folder):
        """Test updating folder color."""
        response = client.patch(
            f"/api/v1/folders/{sample_folder['id']}",
            headers=auth_headers,
            json={"color": "#00FF00"},
        )
        assert response.status_code == 200
        assert response.json()["color"] == "#00FF00"

    def test_update_folder_move_to_parent(self, client, auth_headers, sample_folder):
        """Test moving folder to a parent folder."""
        # Create another folder to be the parent
        parent = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={"name": "Parent Folder"},
        ).json()

        response = client.patch(
            f"/api/v1/folders/{sample_folder['id']}",
            headers=auth_headers,
            json={"parent_id": parent["id"]},
        )
        assert response.status_code == 200
        assert response.json()["parent_id"] == parent["id"]
        assert response.json()["depth"] == 1

    def test_update_folder_duplicate_name(self, client, auth_headers, sample_folder):
        """Test updating folder with duplicate name fails."""
        # Create another folder
        client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={"name": "Other Folder"},
        )

        response = client.patch(
            f"/api/v1/folders/{sample_folder['id']}",
            headers=auth_headers,
            json={"name": "Other Folder"},
        )
        assert response.status_code == 400

    def test_update_folder_not_found(self, client, auth_headers):
        """Test updating non-existent folder."""
        fake_id = str(uuid.uuid4())
        response = client.patch(
            f"/api/v1/folders/{fake_id}",
            headers=auth_headers,
            json={"name": "Updated"},
        )
        assert response.status_code == 404

    def test_cannot_nest_folder_into_itself(self, client, auth_headers, sample_folder):
        """Test that folder cannot be nested into itself."""
        response = client.patch(
            f"/api/v1/folders/{sample_folder['id']}",
            headers=auth_headers,
            json={"parent_id": sample_folder["id"]},
        )
        assert response.status_code == 400


class TestDeleteFolder:
    """Tests for deleting folders."""

    def test_delete_folder_success(self, client, auth_headers, sample_folder):
        """Test deleting a folder."""
        response = client.delete(
            f"/api/v1/folders/{sample_folder['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 204

        # Verify folder is gone
        response = client.get(
            f"/api/v1/folders/{sample_folder['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_folder_moves_notes(self, client, auth_headers, sample_folder):
        """Test that deleting folder handles notes."""
        # Create note in folder
        note_response = client.post(
            "/api/v1/notes",
            headers=auth_headers,
            json={
                "title": "Note in folder",
                "transcript": "Content",
                "folder_id": sample_folder["id"],
            },
        )
        note_id = note_response.json()["id"]

        # Delete folder
        client.delete(
            f"/api/v1/folders/{sample_folder['id']}",
            headers=auth_headers,
        )

        # Note should still exist but without folder
        response = client.get(
            f"/api/v1/notes/{note_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["folder_id"] is None

    def test_delete_folder_not_found(self, client, auth_headers):
        """Test deleting non-existent folder."""
        fake_id = str(uuid.uuid4())
        response = client.delete(
            f"/api/v1/folders/{fake_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestSetupDefaultFolders:
    """Tests for default folder setup."""

    def test_setup_defaults(self, client, auth_headers):
        """Test setting up default folders."""
        response = client.post(
            "/api/v1/folders/setup-defaults",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["created"] > 0

        # Check folders exist
        folders_response = client.get("/api/v1/folders", headers=auth_headers)
        folder_names = [f["name"] for f in folders_response.json()]
        assert "All Notes" in folder_names

    def test_setup_defaults_idempotent(self, client, auth_headers):
        """Test that setup defaults is idempotent."""
        # Call twice
        client.post("/api/v1/folders/setup-defaults", headers=auth_headers)
        response = client.post(
            "/api/v1/folders/setup-defaults",
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Should not duplicate folders
        folders_response = client.get("/api/v1/folders", headers=auth_headers)
        all_notes_count = sum(
            1 for f in folders_response.json() if f["name"] == "All Notes"
        )
        assert all_notes_count == 1


class TestReorderFolders:
    """Tests for folder reordering."""

    def test_reorder_folders(self, client, auth_headers):
        """Test reordering folders."""
        # Create multiple folders
        folder1 = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={"name": "Folder 1"},
        ).json()
        folder2 = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={"name": "Folder 2"},
        ).json()

        # Reorder
        response = client.post(
            "/api/v1/folders/reorder",
            headers=auth_headers,
            json={
                "folders": [
                    {"id": folder2["id"], "sort_order": 0, "parent_id": None},
                    {"id": folder1["id"], "sort_order": 1, "parent_id": None},
                ]
            },
        )
        assert response.status_code == 200

    def test_reorder_with_nesting(self, client, auth_headers, sample_folder):
        """Test reordering with parent change."""
        child = client.post(
            "/api/v1/folders",
            headers=auth_headers,
            json={"name": "Child Folder"},
        ).json()

        # Move child under sample_folder
        response = client.post(
            "/api/v1/folders/reorder",
            headers=auth_headers,
            json={
                "folders": [
                    {
                        "id": child["id"],
                        "sort_order": 0,
                        "parent_id": sample_folder["id"],
                    },
                ]
            },
        )
        assert response.status_code == 200

        # Verify the folder is now nested
        folders_response = client.get("/api/v1/folders", headers=auth_headers)
        parent = next(
            (f for f in folders_response.json() if f["id"] == sample_folder["id"]),
            None,
        )
        assert parent is not None
        assert len(parent["children"]) == 1
