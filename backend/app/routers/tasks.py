"""
CRUD router for Tasks.
Prefix: /api/tasks  (set in main.py)
"""

import json
from datetime import datetime, date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models, schemas

router = APIRouter()

_DAY_NAMES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _next_recurring_date(task: models.Task) -> Optional[date]:
    """Return the next due_date for a recurring task after its current due_date (or today)."""
    if not task.recurrence_rule:
        return None
    try:
        rule = json.loads(task.recurrence_rule)
    except (json.JSONDecodeError, TypeError):
        return None

    base = task.due_date if task.due_date else date.today()
    frequency = rule.get("frequency", "daily")

    if frequency == "daily":
        return base + timedelta(days=1)

    if frequency == "weekly":
        days = rule.get("days", [])
        if not days:
            return base + timedelta(weeks=1)
        # Find the next matching weekday after base
        day_indices = [_DAY_NAMES.index(d) for d in days if d in _DAY_NAMES]
        day_indices.sort()
        base_weekday = base.weekday()  # 0=Mon … 6=Sun
        for di in day_indices:
            if di > base_weekday:
                return base + timedelta(days=di - base_weekday)
        # Wrap to next week: first matching day
        return base + timedelta(days=7 - base_weekday + day_indices[0])

    return None


def _maybe_auto_reset(task: models.Task, db: Session) -> None:
    """For completed recurring tasks whose next due_date has arrived, reset them."""
    if not task.recurrence_rule or not task.completed:
        return
    if task.due_date and task.due_date <= date.today():
        task.completed = False
        task.completed_at = None
        db.commit()
        db.refresh(task)


def _to_response(task: models.Task) -> schemas.TaskResponse:
    today = date.today()
    is_overdue = (
        not task.completed
        and task.due_date is not None
        and task.due_date < today
    )
    return schemas.TaskResponse(
        id=task.id,
        title=task.title,
        due_date=task.due_date,
        completed=task.completed,
        completed_at=task.completed_at,
        profile_id=task.profile_id,
        profile=task.profile,
        subject_profile_id=task.subject_profile_id,
        subject_profile=task.subject_profile,
        recurrence_rule=task.recurrence_rule,
        created_at=task.created_at,
        is_overdue=is_overdue,
    )


# ---------------------------------------------------------------------------
# GET /  — list tasks, optional filters: ?profile_id=1  ?completed=false
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[schemas.TaskResponse])
def list_tasks(
    profile_id: Optional[int] = Query(default=None),
    completed: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Task).options(
        joinedload(models.Task.profile),
        joinedload(models.Task.subject_profile),
    )

    if profile_id is not None:
        query = query.filter(models.Task.profile_id == profile_id)

    if completed is not None:
        query = query.filter(models.Task.completed == completed)

    tasks = query.order_by(models.Task.created_at.desc()).all()
    # Auto-reset recurring tasks whose next occurrence has arrived
    for t in tasks:
        _maybe_auto_reset(t, db)
    return [_to_response(t) for t in tasks]


# ---------------------------------------------------------------------------
# GET /{task_id}  — get one task (404 if not found)
# ---------------------------------------------------------------------------
@router.get("/{task_id}", response_model=schemas.TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = (
        db.query(models.Task)
        .options(
            joinedload(models.Task.profile),
            joinedload(models.Task.subject_profile),
        )
        .filter(models.Task.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return _to_response(task)


# ---------------------------------------------------------------------------
# POST /  — create a task
# ---------------------------------------------------------------------------
@router.post("/", response_model=schemas.TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(body: schemas.TaskCreate, db: Session = Depends(get_db)):
    # Verify profile exists
    profile = db.query(models.Profile).filter(models.Profile.id == body.profile_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile {body.profile_id} not found",
        )

    # Verify subject_profile exists if provided
    if body.subject_profile_id is not None:
        subject_profile = db.query(models.Profile).filter(models.Profile.id == body.subject_profile_id).first()
        if not subject_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Subject profile {body.subject_profile_id} not found",
            )

    task = models.Task(
        title=body.title,
        due_date=body.due_date,
        completed=body.completed,
        profile_id=body.profile_id,
        subject_profile_id=body.subject_profile_id,
        recurrence_rule=body.recurrence_rule,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # Re-query to load the profile relationships
    task = (
        db.query(models.Task)
        .options(
            joinedload(models.Task.profile),
            joinedload(models.Task.subject_profile),
        )
        .filter(models.Task.id == task.id)
        .first()
    )
    return _to_response(task)


# ---------------------------------------------------------------------------
# PUT /{task_id}  — full update (title, due_date, profile_id, completed)
# ---------------------------------------------------------------------------
@router.put("/{task_id}", response_model=schemas.TaskResponse)
def update_task(task_id: int, body: schemas.TaskCreate, db: Session = Depends(get_db)):
    task = (
        db.query(models.Task)
        .options(
            joinedload(models.Task.profile),
            joinedload(models.Task.subject_profile),
        )
        .filter(models.Task.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Verify new profile exists if changing
    if body.profile_id != task.profile_id:
        profile = db.query(models.Profile).filter(models.Profile.id == body.profile_id).first()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profile {body.profile_id} not found",
            )

    # Verify subject_profile exists if provided
    if body.subject_profile_id is not None:
        subject_profile = db.query(models.Profile).filter(models.Profile.id == body.subject_profile_id).first()
        if not subject_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Subject profile {body.subject_profile_id} not found",
            )

    task.title = body.title
    task.due_date = body.due_date
    task.profile_id = body.profile_id
    task.completed = body.completed
    task.subject_profile_id = body.subject_profile_id
    task.recurrence_rule = body.recurrence_rule

    # If being marked complete via PUT, set completed_at
    if body.completed and task.completed_at is None:
        task.completed_at = datetime.utcnow()
    elif not body.completed:
        task.completed_at = None

    db.commit()
    db.refresh(task)

    # Re-query to reload profile relationships after potential changes
    task = (
        db.query(models.Task)
        .options(
            joinedload(models.Task.profile),
            joinedload(models.Task.subject_profile),
        )
        .filter(models.Task.id == task_id)
        .first()
    )
    return _to_response(task)


# ---------------------------------------------------------------------------
# PATCH /{task_id}/complete  — mark task complete
# ---------------------------------------------------------------------------
@router.patch("/{task_id}/complete", response_model=schemas.TaskResponse)
def complete_task(task_id: int, db: Session = Depends(get_db)):
    task = (
        db.query(models.Task)
        .options(
            joinedload(models.Task.profile),
            joinedload(models.Task.subject_profile),
        )
        .filter(models.Task.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    task.completed = True
    task.completed_at = datetime.utcnow()
    # For recurring tasks, advance the due_date to the next occurrence so it
    # resets automatically when that date arrives.
    if task.recurrence_rule:
        next_date = _next_recurring_date(task)
        if next_date:
            task.due_date = next_date
    db.commit()
    db.refresh(task)

    task = (
        db.query(models.Task)
        .options(
            joinedload(models.Task.profile),
            joinedload(models.Task.subject_profile),
        )
        .filter(models.Task.id == task_id)
        .first()
    )
    return _to_response(task)


# ---------------------------------------------------------------------------
# PATCH /{task_id}/uncomplete  — mark task incomplete
# ---------------------------------------------------------------------------
@router.patch("/{task_id}/uncomplete", response_model=schemas.TaskResponse)
def uncomplete_task(task_id: int, db: Session = Depends(get_db)):
    task = (
        db.query(models.Task)
        .options(
            joinedload(models.Task.profile),
            joinedload(models.Task.subject_profile),
        )
        .filter(models.Task.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    task.completed = False
    task.completed_at = None
    db.commit()
    db.refresh(task)

    task = (
        db.query(models.Task)
        .options(
            joinedload(models.Task.profile),
            joinedload(models.Task.subject_profile),
        )
        .filter(models.Task.id == task_id)
        .first()
    )
    return _to_response(task)


# ---------------------------------------------------------------------------
# DELETE /{task_id}  — delete a task (204 No Content)
# ---------------------------------------------------------------------------
@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    db.delete(task)
    db.commit()
