"""FastAPI Application Entry Point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import init_db, close_db
from app.routers import auth, notes, voice, integrations, actions, folders

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    print("Starting Glide API...")

    # Create database tables
    if settings.debug:
        await init_db()
        print("Database tables created")

    yield

    # Shutdown
    print("Shutting down Glide API...")
    await close_db()


app = FastAPI(
    title="Glide API",
    description="Voice memo to action - AI-powered note taking",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins if not settings.debug else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(
    auth.router,
    prefix="/api/v1/auth",
    tags=["Authentication"]
)

app.include_router(
    notes.router,
    prefix="/api/v1/notes",
    tags=["Notes"]
)

app.include_router(
    folders.router,
    prefix="/api/v1/folders",
    tags=["Folders"]
)

app.include_router(
    voice.router,
    prefix="/api/v1/voice",
    tags=["Voice Processing"]
)

app.include_router(
    actions.router,
    prefix="/api/v1/actions",
    tags=["Actions"]
)

app.include_router(
    integrations.router,
    prefix="/api/v1/integrations",
    tags=["Integrations"]
)


@app.get("/")
async def root():
    """API root endpoint."""
    return {
        "name": "Glide API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "database": "connected",
    }


# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": str(exc) if settings.debug else "An unexpected error occurred",
        },
    )
