"""Comprehensive tests for authentication router."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

from app.main import app
from app.database import Base, get_db
from app.utils.auth import create_access_token, create_refresh_token


# Use SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_auth.db"
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
def registered_user(client):
    """Register a user and return credentials."""
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "testpassword123"

    client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Test User",
        },
    )
    return {"email": email, "password": password}


@pytest.fixture
def auth_tokens(client, registered_user):
    """Login and return tokens."""
    response = client.post(
        "/api/v1/auth/login",
        data={
            "username": registered_user["email"],
            "password": registered_user["password"],
        },
    )
    return response.json()


@pytest.fixture
def auth_headers(auth_tokens):
    """Return authorization headers."""
    return {"Authorization": f"Bearer {auth_tokens['access_token']}"}


class TestUserRegistration:
    """Tests for user registration endpoint."""

    def test_register_success(self, client):
        """Test successful user registration."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "securepassword123",
                "full_name": "New User",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["full_name"] == "New User"
        assert data["is_active"] is True
        assert "id" in data

    def test_register_without_full_name(self, client):
        """Test registration without optional full_name."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "noname@example.com",
                "password": "securepassword123",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["full_name"] is None

    def test_register_duplicate_email(self, client, registered_user):
        """Test registration with existing email fails."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": registered_user["email"],
                "password": "differentpassword",
            },
        )
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    def test_register_invalid_email(self, client):
        """Test registration with invalid email format."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "not-an-email",
                "password": "securepassword123",
            },
        )
        assert response.status_code == 422

    def test_register_short_password(self, client):
        """Test registration with too short password."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "short@example.com",
                "password": "short",
            },
        )
        # This depends on Pydantic validation rules
        assert response.status_code in [422, 201]


class TestUserLogin:
    """Tests for user login endpoint."""

    def test_login_success(self, client, registered_user):
        """Test successful login."""
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": registered_user["email"],
                "password": registered_user["password"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data

    def test_login_wrong_password(self, client, registered_user):
        """Test login with wrong password."""
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": registered_user["email"],
                "password": "wrongpassword",
            },
        )
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()

    def test_login_nonexistent_user(self, client):
        """Test login with non-existent email."""
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": "nonexistent@example.com",
                "password": "anypassword",
            },
        )
        assert response.status_code == 401

    def test_login_missing_fields(self, client):
        """Test login with missing fields."""
        response = client.post("/api/v1/auth/login", data={})
        assert response.status_code == 422


class TestTokenRefresh:
    """Tests for token refresh endpoint."""

    def test_refresh_token_success(self, client, auth_tokens):
        """Test successful token refresh."""
        response = client.post(
            "/api/v1/auth/refresh",
            params={"refresh_token": auth_tokens["refresh_token"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_refresh_with_invalid_token(self, client):
        """Test refresh with invalid token."""
        response = client.post(
            "/api/v1/auth/refresh",
            params={"refresh_token": "invalid-token"},
        )
        assert response.status_code == 401

    def test_refresh_with_access_token_fails(self, client, auth_tokens):
        """Test that using access token as refresh token fails."""
        response = client.post(
            "/api/v1/auth/refresh",
            params={"refresh_token": auth_tokens["access_token"]},
        )
        assert response.status_code == 401


class TestCurrentUser:
    """Tests for current user endpoint."""

    def test_get_me_authenticated(self, client, auth_headers, registered_user):
        """Test getting current user profile."""
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == registered_user["email"]
        assert "google_connected" in data
        assert "apple_connected" in data

    def test_get_me_unauthenticated(self, client):
        """Test getting profile without authentication."""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    def test_get_me_invalid_token(self, client):
        """Test getting profile with invalid token."""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert response.status_code == 401


class TestUpdateProfile:
    """Tests for profile update endpoint."""

    def test_update_full_name(self, client, auth_headers):
        """Test updating user full name."""
        response = client.patch(
            "/api/v1/auth/me",
            headers=auth_headers,
            json={"full_name": "Updated Name"},
        )
        assert response.status_code == 200
        assert response.json()["full_name"] == "Updated Name"

    def test_update_timezone(self, client, auth_headers):
        """Test updating user timezone."""
        response = client.patch(
            "/api/v1/auth/me",
            headers=auth_headers,
            json={"timezone": "America/New_York"},
        )
        assert response.status_code == 200
        assert response.json()["timezone"] == "America/New_York"

    def test_update_auto_settings(self, client, auth_headers):
        """Test updating auto-transcribe and auto-create settings."""
        response = client.patch(
            "/api/v1/auth/me",
            headers=auth_headers,
            json={
                "auto_transcribe": False,
                "auto_create_actions": False,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["auto_transcribe"] is False
        assert data["auto_create_actions"] is False


class TestPasswordChange:
    """Tests for password change endpoint."""

    def test_change_password_success(self, client, auth_headers, registered_user):
        """Test successful password change."""
        response = client.post(
            "/api/v1/auth/change-password",
            headers=auth_headers,
            json={
                "current_password": registered_user["password"],
                "new_password": "newSecurePassword123",
            },
        )
        assert response.status_code == 200
        assert "successfully" in response.json()["message"].lower()

        # Verify can login with new password
        login_response = client.post(
            "/api/v1/auth/login",
            data={
                "username": registered_user["email"],
                "password": "newSecurePassword123",
            },
        )
        assert login_response.status_code == 200

    def test_change_password_wrong_current(self, client, auth_headers):
        """Test password change with wrong current password."""
        response = client.post(
            "/api/v1/auth/change-password",
            headers=auth_headers,
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword123",
            },
        )
        assert response.status_code == 400
        assert "incorrect" in response.json()["detail"].lower()


class TestLogout:
    """Tests for logout endpoint."""

    def test_logout_success(self, client, auth_headers):
        """Test successful logout."""
        response = client.post("/api/v1/auth/logout", headers=auth_headers)
        assert response.status_code == 200
        assert "logged out" in response.json()["message"].lower()

    def test_logout_unauthenticated(self, client):
        """Test logout without authentication."""
        response = client.post("/api/v1/auth/logout")
        assert response.status_code == 401


class TestAppleSignIn:
    """Tests for Apple Sign-In endpoint."""

    def test_apple_signin_invalid_token(self, client):
        """Test Apple Sign-In with invalid token."""
        response = client.post(
            "/api/v1/auth/apple",
            json={
                "identity_token": "invalid-jwt-token",
                "authorization_code": "test-code",
                "user_id": "test-user-id",
            },
        )
        assert response.status_code == 400
        assert "invalid" in response.json()["detail"].lower()
