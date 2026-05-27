"""
CRUD router for MealPlans.
Prefix: /api/meals  (set in main.py)

Endpoints:
  GET  /           — list meals, optionally filtered by ?start=YYYY-MM-DD&end=YYYY-MM-DD
  POST /           — upsert a meal (create or update by date + meal_type)
  DELETE /{id}     — delete a meal entry (204)
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: fetch a single meal or raise 404
# ---------------------------------------------------------------------------
def _get_meal_or_404(meal_id: int, db: Session) -> models.MealPlan:
    meal = db.query(models.MealPlan).filter(models.MealPlan.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal not found")
    return meal


# ---------------------------------------------------------------------------
# GET /  — list meals, optionally filtered by date range
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[schemas.MealPlanResponse])
def list_meals(
    start: Optional[date] = Query(None, description="Include meals on or after this date (YYYY-MM-DD)"),
    end: Optional[date] = Query(None, description="Include meals on or before this date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    query = db.query(models.MealPlan).order_by(models.MealPlan.date, models.MealPlan.meal_type)

    if start is not None:
        query = query.filter(models.MealPlan.date >= start)
    if end is not None:
        query = query.filter(models.MealPlan.date <= end)

    return query.all()


# ---------------------------------------------------------------------------
# POST /  — upsert a meal (create or update by date + meal_type)
# ---------------------------------------------------------------------------
@router.post("/", response_model=schemas.MealPlanResponse, status_code=status.HTTP_200_OK)
def upsert_meal(body: schemas.MealPlanCreate, db: Session = Depends(get_db)):
    # Look for an existing entry with the same date + meal_type
    existing = (
        db.query(models.MealPlan)
        .filter(
            models.MealPlan.date == body.date,
            models.MealPlan.meal_type == body.meal_type,
        )
        .first()
    )

    if existing:
        # Update description in place
        existing.description = body.description
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create a new entry
        meal = models.MealPlan(
            date=body.date,
            meal_type=body.meal_type,
            description=body.description,
        )
        db.add(meal)
        db.commit()
        db.refresh(meal)
        return meal


# ---------------------------------------------------------------------------
# DELETE /{meal_id}  — delete a meal entry
# ---------------------------------------------------------------------------
@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal(meal_id: int, db: Session = Depends(get_db)):
    meal = _get_meal_or_404(meal_id, db)
    db.delete(meal)
    db.commit()
