"""Application configuration using Pydantic Settings."""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Local development mode
    use_sqlite: bool = True  # Use SQLite for local dev (set to False for PostgreSQL)
    use_local_storage: bool = True  # Use local filesystem instead of S3

    # API Keys (optional - mock responses used when not configured)
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    groq_api_key: str = ""  # Groq for fast Whisper transcription and LLM inference

    # Supabase (optional for local dev)
    supabase_url: str = ""
    supabase_anon_key: str = ""

    # Database - defaults to SQLite for local dev
    database_url: str = ""

    @property
    def database_url_async(self) -> str:
        """Return async database URL."""
        if self.database_url:
            return self.database_url
        if self.use_sqlite:
            return "sqlite+aiosqlite:///./glide.db"
        return "postgresql+asyncpg://postgres:password@localhost:5432/glide"

    @property
    def database_url_sync(self) -> str:
        """Return sync database URL for Alembic."""
        url = self.database_url_async
        return url.replace("+asyncpg", "").replace("+aiosqlite", "")

    @property
    def is_sqlite(self) -> bool:
        """Check if using SQLite."""
        return "sqlite" in self.database_url_async

    # Local storage path for audio files
    local_storage_path: str = "./uploads"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # JWT
    secret_key: str = "change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = "glide-audio-files"

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/integrations/google/callback"

    # Apple CalDAV
    apple_caldav_url: str = "https://caldav.icloud.com"

    # App Settings
    debug: bool = True
    allowed_origins: str = "http://localhost:3000,exp://localhost:8081"

    @property
    def cors_origins(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
