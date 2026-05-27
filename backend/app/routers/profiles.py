"""
CRUD router for Profiles.
Prefix: /profiles  (set in main.py)
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter()


# ---------------------------------------------------------------------------
# GET /  — list all profiles
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[schemas.ProfileResponse])
def list_profiles(db: Session = Depends(get_db)):
    return db.query(models.Profile).order_by(models.Profile.created_at).all()


# ---------------------------------------------------------------------------
# GET /{profile_id}  — get one profile
# ---------------------------------------------------------------------------
@router.get("/{profile_id}", response_model=schemas.ProfileResponse)
def get_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(models.Profile).filter(models.Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return profile


# ---------------------------------------------------------------------------
# POST /  — create a profile
# ---------------------------------------------------------------------------
@router.post("/", response_model=schemas.ProfileResponse, status_code=status.HTTP_201_CREATED)
def create_profile(body: schemas.ProfileCreate, db: Session = Depends(get_db)):
    profile = models.Profile(
        name=body.name,
        colour=body.colour,
        avatar_emoji=body.avatar_emoji,
        google_calendar_id=body.google_calendar_id,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


# ---------------------------------------------------------------------------
# PUT /{profile_id}  — replace / full-update a profile
# ---------------------------------------------------------------------------
@router.put("/{profile_id}", response_model=schemas.ProfileResponse)
def update_profile(profile_id: int, body: schemas.ProfileCreate, db: Session = Depends(get_db)):
    profile = db.query(models.Profile).filter(models.Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    profile.name = body.name
    profile.colour = body.colour
    profile.avatar_emoji = body.avatar_emoji
    profile.google_calendar_id = body.google_calendar_id

    db.commit()
    db.refresh(profile)
    return profile


# ---------------------------------------------------------------------------
# PATCH /{profile_id}  — partial-update a profile (used by the frontend client)
# ---------------------------------------------------------------------------
@router.patch("/{profile_id}", response_model=schemas.ProfileResponse)
def patch_profile(profile_id: int, body: schemas.ProfileCreate, db: Session = Depends(get_db)):
    profile = db.query(models.Profile).filter(models.Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile


# ---------------------------------------------------------------------------
# DELETE /{profile_id}  — delete a profile
# ---------------------------------------------------------------------------
@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(models.Profile).filter(models.Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    db.delete(profile)
    db.commit()
