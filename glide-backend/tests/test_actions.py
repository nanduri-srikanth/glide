"""Comprehensive tests for actions router."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

from app.main import app
from app.database import Base, get_db


# Use SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_actions.db"
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
def sample_note_with_actions(client, auth_headers):
    """
    Create a sample note with actions.
    Note: In actual app, actions are created via voice processing.
    This fixture simulates that by creating a note first.
    """
    response = client.post(
        "/api/v1/notes",
        headers=auth_headers,
        json={
            "title": "Meeting Notes",
            "transcript": "Schedule a meeting with John for next week. Send an email to the team about the project update.",
        },
    )
    return response.json()


class TestListActions:
    """Tests for listing actions."""

    def test_list_actions_empty(self, client, auth_headers):
        """Test listing actions when none exist."""
        response = client.get("/api/v1/actions", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_actions_unauthenticated(self, client):
        """Test listing actions without authentication."""
        response = client.get("/api/v1/actions")
        assert response.status_code == 401

    def test_list_actions_with_limit(self, client, auth_headers):
        """Test listing actions with limit parameter."""
        response = client.get(
            "/api/v1/actions?limit=10",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_list_actions_filter_by_type(self, client, auth_headers):
        """Test filtering actions by type."""
        response = client.get(
            "/api/v1/actions?action_type=calendar",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_list_actions_filter_by_status(self, client, auth_headers):
        """Test filtering actions by status."""
        response = client.get(
            "/api/v1/actions?status=pending",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_list_actions_filter_by_note(self, client, auth_headers, sample_note_with_actions):
        """Test filtering actions by note ID."""
        note_id = sample_note_with_actions["id"]
        response = client.get(
            f"/api/v1/actions?note_id={note_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200


class TestGetAction:
    """Tests for getting a single action."""

    def test_get_action_not_found(self, client, auth_headers):
        """Test getting non-existent action."""
        fake_id = str(uuid.uuid4())
        response = client.get(
            f"/api/v1/actions/{fake_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_get_action_unauthenticated(self, client):
        """Test getting action without authentication."""
        fake_id = str(uuid.uuid4())
        response = client.get(f"/api/v1/actions/{fake_id}")
        assert response.status_code == 401


class TestUpdateAction:
    """Tests for updating actions."""

    def test_update_action_not_found(self, client, auth_headers):
        """Test updating non-existent action."""
        fake_id = str(uuid.uuid4())
        response = client.patch(
            f"/api/v1/actions/{fake_id}",
            headers=auth_headers,
            json={"title": "Updated Title"},
        )
        assert response.status_code == 404

    def test_update_action_unauthenticated(self, client):
        """Test updating action without authentication."""
        fake_id = str(uuid.uuid4())
        response = client.patch(
            f"/api/v1/actions/{fake_id}",
            json={"title": "Updated"},
        )
        assert response.status_code == 401


class TestDeleteAction:
    """Tests for deleting actions."""

    def test_delete_action_not_found(self, client, auth_headers):
        """Test deleting non-existent action."""
        fake_id = str(uuid.uuid4())
        response = client.delete(
            f"/api/v1/actions/{fake_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_action_unauthenticated(self, client):
        """Test deleting action without authentication."""
        fake_id = str(uuid.uuid4())
        response = client.delete(f"/api/v1/actions/{fake_id}")
        assert response.status_code == 401


class TestExecuteAction:
    """Tests for executing actions."""

    def test_execute_action_not_found(self, client, auth_headers):
        """Test executing non-existent action."""
        fake_id = str(uuid.uuid4())
        response = client.post(
            f"/api/v1/actions/{fake_id}/execute",
            headers=auth_headers,
            json={"service": "google"},
        )
        assert response.status_code == 404

    def test_execute_action_unauthenticated(self, client):
        """Test executing action without authentication."""
        fake_id = str(uuid.uuid4())
        response = client.post(
            f"/api/v1/actions/{fake_id}/execute",
            json={"service": "google"},
        )
        assert response.status_code == 401

    def test_execute_action_missing_service(self, client, auth_headers):
        """Test executing action without specifying service."""
        fake_id = str(uuid.uuid4())
        response = client.post(
            f"/api/v1/actions/{fake_id}/execute",
            headers=auth_headers,
            json={},
        )
        assert response.status_code in [404, 422]


class TestCompleteAction:
    """Tests for marking actions as complete."""

    def test_complete_action_not_found(self, client, auth_headers):
        """Test completing non-existent action."""
        fake_id = str(uuid.uuid4())
        response = client.post(
            f"/api/v1/actions/{fake_id}/complete",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_complete_action_unauthenticated(self, client):
        """Test completing action without authentication."""
        fake_id = str(uuid.uuid4())
        response = client.post(f"/api/v1/actions/{fake_id}/complete")
        assert response.status_code == 401


class TestActionIntegration:
    """Integration tests for actions workflow."""

    def test_action_list_filter_combinations(self, client, auth_headers):
        """Test combining multiple filters."""
        response = client.get(
            "/api/v1/actions?action_type=calendar&status=pending&limit=25",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_action_type_values(self, client, auth_headers):
        """Test that action type filters accept correct values."""
        for action_type in ["calendar", "email", "reminder", "next_step"]:
            response = client.get(
                f"/api/v1/actions?action_type={action_type}",
                headers=auth_headers,
            )
            assert response.status_code == 200

    def test_action_status_values(self, client, auth_headers):
        """Test that status filters accept correct values."""
        for status in ["pending", "created", "executed", "failed", "cancelled"]:
            response = client.get(
                f"/api/v1/actions?status={status}",
                headers=auth_headers,
            )
            assert response.status_code == 200

    def test_action_invalid_uuid(self, client, auth_headers):
        """Test that invalid UUID returns proper error."""
        response = client.get(
            "/api/v1/actions/not-a-uuid",
            headers=auth_headers,
        )
        assert response.status_code == 422
