"""
Routines router — morning / evening / bedtime checklists with streaks.

Three fixed slots are auto-created on first access. Items can be added,
edited, reordered, and deleted. Completions are per-day.
"""

import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Routine, RoutineItem, RoutineCompletion, RoutineStreak
from app.schemas import (
    RoutineItemCreate,
    RoutineItemUpdate,
    RoutineItemResponse,
    RoutineTodayResponse,
    RoutineToggleResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()

SLOTS = ["morning", "evening", "bedtime"]

DEFAULT_ITEMS: dict[str, list[str]] = {
    "morning": ["Brush teeth", "Get dressed", "Make bed", "Have breakfast"],
    "evening": ["Tidy room", "Pack school bag", "Do homework", "Have a bath"],
    "bedtime": ["Brush teeth", "Wash face", "Put on pyjamas", "Read a book"],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_or_create_routine(slot: str, db: Session) -> Routine:
    routine = db.query(Routine).filter(Routine.slot == slot).first()
    if not routine:
        routine = Routine(slot=slot)
        db.add(routine)
        db.flush()
        for i, text in enumerate(DEFAULT_ITEMS.get(slot, [])):
            db.add(RoutineItem(routine_id=routine.id, text=text, position=i))
        db.commit()
        db.refresh(routine)
    return routine


def _is_slot_complete(routine: Routine, check_date: date, db: Session) -> bool:
    items = db.query(RoutineItem).filter(RoutineItem.routine_id == routine.id).all()
    if not items:
        return False
    completed_ids = {
        c.item_id
        for c in db.query(RoutineCompletion).filter(
            RoutineCompletion.item_id.in_([i.id for i in items]),
            RoutineCompletion.completion_date == check_date,
        ).all()
    }
    return all(item.id in completed_ids for item in items)


def _update_streak(routine: Routine, db: Session) -> None:
    today = date.today()
    yesterday = today - timedelta(days=1)

    if not _is_slot_complete(routine, today, db):
        return

    streak = db.query(RoutineStreak).filter(RoutineStreak.routine_id == routine.id).first()
    if not streak:
        streak = RoutineStreak(routine_id=routine.id, current_streak=0, longest_streak=0)
        db.add(streak)

    if streak.last_complete_date == today:
        return  # already counted
    elif streak.last_complete_date == yesterday:
        streak.current_streak += 1
    else:
        streak.current_streak = 1

    streak.last_complete_date = today
    if streak.current_streak > streak.longest_streak:
        streak.longest_streak = streak.current_streak

    db.commit()


def _build_history(routine: Routine, db: Session) -> list[bool]:
    today = date.today()
    items = db.query(RoutineItem).filter(RoutineItem.routine_id == routine.id).all()
    history = []
    for days_ago in range(6, -1, -1):
        check_date = today - timedelta(days=days_ago)
        if items:
            completed_ids = {
                c.item_id
                for c in db.query(RoutineCompletion).filter(
                    RoutineCompletion.item_id.in_([i.id for i in items]),
                    RoutineCompletion.completion_date == check_date,
                ).all()
            }
            history.append(all(item.id in completed_ids for item in items))
        else:
            history.append(False)
    return history


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/today", response_model=RoutineTodayResponse)
def get_today(db: Session = Depends(get_db)):
    """Return today's state for all three routine slots."""
    today = date.today()
    slots_data = []

    for slot_name in SLOTS:
        routine = _get_or_create_routine(slot_name, db)
        items = (
            db.query(RoutineItem)
            .filter(RoutineItem.routine_id == routine.id)
            .order_by(RoutineItem.position)
            .all()
        )

        today_completed_ids = {
            c.item_id
            for c in db.query(RoutineCompletion).filter(
                RoutineCompletion.item_id.in_([i.id for i in items]),
                RoutineCompletion.completion_date == today,
            ).all()
        } if items else set()

        items_data = [
            {
                "id": item.id,
                "routine_id": item.routine_id,
                "text": item.text,
                "position": item.position,
                "completed_today": item.id in today_completed_ids,
            }
            for item in items
        ]

        slot_complete = bool(items) and all(i["completed_today"] for i in items_data)

        streak = db.query(RoutineStreak).filter(RoutineStreak.routine_id == routine.id).first()
        streak_data = {
            "current_streak": streak.current_streak if streak else 0,
            "longest_streak": streak.longest_streak if streak else 0,
            "last_complete_date": streak.last_complete_date if streak else None,
        }

        slots_data.append({
            "slot": slot_name,
            "routine_id": routine.id,
            "items": items_data,
            "streak": streak_data,
            "slot_complete": slot_complete,
            "history": _build_history(routine, db),
        })

    perfect_day = all(s["slot_complete"] for s in slots_data)

    return {
        "date": today.isoformat(),
        "slots": slots_data,
        "perfect_day": perfect_day,
    }


@router.post("/items/{item_id}/toggle", response_model=RoutineToggleResponse)
def toggle_item(item_id: int, db: Session = Depends(get_db)):
    """Toggle completion of a routine item for today."""
    today = date.today()
    item = db.query(RoutineItem).filter(RoutineItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    existing = (
        db.query(RoutineCompletion)
        .filter(
            RoutineCompletion.item_id == item_id,
            RoutineCompletion.completion_date == today,
        )
        .first()
    )

    if existing:
        db.delete(existing)
        db.commit()
        completed = False
    else:
        db.add(RoutineCompletion(item_id=item_id, completion_date=today))
        db.commit()
        completed = True

    routine = db.query(Routine).filter(Routine.id == item.routine_id).first()
    _update_streak(routine, db)
    slot_complete = _is_slot_complete(routine, today, db)

    return {"item_id": item_id, "completed": completed, "slot_complete": slot_complete}


@router.post("/{routine_id}/items", response_model=RoutineItemResponse)
def add_item(routine_id: int, body: RoutineItemCreate, db: Session = Depends(get_db)):
    """Add an item to a routine slot."""
    routine = db.query(Routine).filter(Routine.id == routine_id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Routine not found")

    # Auto-position at end if not specified
    if body.position == 0:
        max_pos = (
            db.query(RoutineItem)
            .filter(RoutineItem.routine_id == routine_id)
            .count()
        )
        position = max_pos
    else:
        position = body.position

    item = RoutineItem(routine_id=routine_id, text=body.text, position=position)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=RoutineItemResponse)
def update_item(item_id: int, body: RoutineItemUpdate, db: Session = Depends(get_db)):
    """Update an item's text or position."""
    item = db.query(RoutineItem).filter(RoutineItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if body.text is not None:
        item.text = body.text
    if body.position is not None:
        item.position = body.position

    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    """Delete a routine item."""
    item = db.query(RoutineItem).filter(RoutineItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()
    return {"deleted": True}
