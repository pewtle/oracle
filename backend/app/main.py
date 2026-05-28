"""
Odysseus Family Planner — FastAPI application entry point.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import init_db
from app.routers import profiles, events, tasks, meals, lists, google_calendar, photos, recipes, routines
from app.sync_service import sync_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialise DB on startup, start background sync."""
    init_db()
    await sync_service.start()
    yield
    await sync_service.stop()


app = FastAPI(
    title="Odysseus Family Planner",
    description="A locally-hosted family planner with calendar, tasks, meals, and lists.",
    version="0.1.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — allow all origins so any device on the local network can connect
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# API routers
# ---------------------------------------------------------------------------
app.include_router(profiles.router, prefix="/api/profiles", tags=["profiles"])
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(meals.router, prefix="/api/meals", tags=["meals"])
app.include_router(lists.router, prefix="/api/lists", tags=["lists"])
app.include_router(google_calendar.router, prefix="/api/google-calendar", tags=["google-calendar"])
app.include_router(photos.router, prefix="/api/photos", tags=["photos"])
app.include_router(recipes.router, prefix="/api/recipes", tags=["recipes"])
app.include_router(routines.router, prefix="/api/routines", tags=["routines"])


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Serve built frontend as static files (production mode)
# Mount AFTER API routes so /api/* is handled first
# ---------------------------------------------------------------------------
_FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if _FRONTEND_DIST.exists():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=str(_FRONTEND_DIST / "assets")), name="assets")

    # Catch-all: serve index.html for any non-API route (SPA client-side routing)
    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        index = _FRONTEND_DIST / "index.html"
        return FileResponse(str(index))
