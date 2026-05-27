"""
Photos router — serves photos from a local directory for the screensaver.
The directory defaults to ./data/photos/ but can be overridden with
the PHOTOS_DIR environment variable (useful on the Pi: /home/pi/photos).

GET /api/photos        — list available photo filenames
GET /api/photos/{name} — stream the photo file
"""

import os
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

_ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}

_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


def _photos_dir() -> Path:
    env = os.getenv("PHOTOS_DIR")
    if env:
        return Path(env)
    p = _BACKEND_ROOT / "data" / "photos"
    p.mkdir(parents=True, exist_ok=True)
    return p


@router.get("/", response_model=List[str])
def list_photos():
    d = _photos_dir()
    names = [
        f.name for f in sorted(d.iterdir())
        if f.is_file() and f.suffix.lower() in _ALLOWED_SUFFIXES
    ]
    return names


@router.get("/{filename}")
def get_photo(filename: str):
    # Guard against path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = _photos_dir() / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Photo not found")
    if path.suffix.lower() not in _ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    return FileResponse(str(path))
