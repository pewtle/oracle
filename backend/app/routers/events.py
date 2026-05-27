"""
CRUD router for CalendarEvents.
Prefix: /api/events  (set in main.py)
"""

import json
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models, schemas

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: load event with profiles eagerly to avoid N+1 queries
# ---------------------------------------------------------------------------
def _get_event_or_404(event_id: int, db: Session) -> models.CalendarEvent:
    event = (
        db.query(models.CalendarEvent)
        .options(joinedload(models.CalendarEvent.profiles))
        .filter(models.CalendarEvent.id == event_id)
        .first()
    )
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


# ---------------------------------------------------------------------------
# Helper: serialise a CalendarEvent ORM object to a response dict
# ---------------------------------------------------------------------------
def _event_to_dict(event: models.CalendarEvent, is_recurring_instance: bool = False, recurrence_source_id: Optional[int] = None) -> dict:
    return {
        'id': event.id,
        'title': event.title,
        'date': event.date.isoformat(),
        'start_time': str(event.start_time) if event.start_time else None,
        'end_time': str(event.end_time) if event.end_time else None,
        'all_day': event.all_day,
        'colour_override': event.colour_override,
        'google_event_id': event.google_event_id,
        'google_calendar_id': event.google_calendar_id,
        'source': event.source,
        'recurrence_rule': event.recurrence_rule,
        'is_recurring_instance': is_recurring_instance,
        'recurrence_source_id': recurrence_source_id,
        'profiles': [
            {
                'id': p.id,
                'name': p.name,
                'colour': p.colour,
                'avatar_emoji': p.avatar_emoji,
                'google_calendar_id': p.google_calendar_id,
                'created_at': p.created_at.isoformat() if p.created_at else None,
            }
            for p in event.profiles
        ],
        'created_at': event.created_at.isoformat() if event.created_at else None,
        'updated_at': event.updated_at.isoformat() if event.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Helper: expand a recurring event into virtual instances within [start, end]
# ---------------------------------------------------------------------------
def expand_recurring_event(event: models.CalendarEvent, start: date, end: date) -> list:
    """Generate instances of a recurring event within [start, end]."""
    if not event.recurrence_rule:
        return []

    try:
        rule = json.loads(event.recurrence_rule)
    except (json.JSONDecodeError, TypeError):
        return []

    frequency = rule.get('frequency', 'weekly')
    days = rule.get('days', [])  # e.g. ['mon', 'wed', 'fri']

    day_map = {'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6}
    target_weekdays = {day_map[d] for d in days if d in day_map}

    instances = []
    current = start
    # Don't re-add the original event's own date
    original_date = event.date

    while current <= end:
        should_include = False
        if frequency == 'daily':
            should_include = True
        elif frequency == 'weekly':
            if target_weekdays:
                should_include = current.weekday() in target_weekdays
            else:
                # Same weekday as original
                should_include = current.weekday() == original_date.weekday()

        if should_include and current != original_date:
            instances.append({
                'id': event.id,  # same ID as template
                'title': event.title,
                'date': current.isoformat(),
                'start_time': str(event.start_time) if event.start_time else None,
                'end_time': str(event.end_time) if event.end_time else None,
                'all_day': event.all_day,
                'colour_override': event.colour_override,
                'google_event_id': None,
                'google_calendar_id': None,
                'source': event.source,
                'recurrence_rule': event.recurrence_rule,
                'is_recurring_instance': True,
                'recurrence_source_id': event.id,
                'profiles': [
                    {
                        'id': p.id,
                        'name': p.name,
                        'colour': p.colour,
                        'avatar_emoji': p.avatar_emoji,
                        'google_calendar_id': p.google_calendar_id,
                        'created_at': p.created_at.isoformat() if p.created_at else None,
                    }
                    for p in event.profiles
                ],
                'created_at': event.created_at.isoformat() if event.created_at else None,
                'updated_at': event.updated_at.isoformat() if event.updated_at else None,
            })
        current += timedelta(days=1)

    return instances


# ---------------------------------------------------------------------------
# GET /  — list events, optionally filtered by date range
# ---------------------------------------------------------------------------
@router.get("/")
def list_events(
    start: Optional[date] = Query(None, description="Filter events on or after this date (YYYY-MM-DD)"),
    end: Optional[date] = Query(None, description="Filter events on or before this date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    query = (
        db.query(models.CalendarEvent)
        .options(joinedload(models.CalendarEvent.profiles))
        .order_by(models.CalendarEvent.date, models.CalendarEvent.start_time)
    )

    if start is not None:
        query = query.filter(models.CalendarEvent.date >= start)
    if end is not None:
        query = query.filter(models.CalendarEvent.date <= end)

    all_events = query.all()

    result = []
    for event in all_events:
        # Add the event itself (not a recurring instance)
        result.append(_event_to_dict(event, is_recurring_instance=False, recurrence_source_id=None))
        # Expand recurring instances if the event has a recurrence rule and we have a date range
        if event.recurrence_rule and start is not None and end is not None:
            for instance_dict in expand_recurring_event(event, start, end):
                result.append(instance_dict)

    return result


# ---------------------------------------------------------------------------
# GET /{event_id}  — get one event
# ---------------------------------------------------------------------------
@router.get("/{event_id}", response_model=schemas.CalendarEventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    return _get_event_or_404(event_id, db)


# ---------------------------------------------------------------------------
# POST /  — create event
# ---------------------------------------------------------------------------
@router.post("/", response_model=schemas.CalendarEventResponse, status_code=status.HTTP_201_CREATED)
def create_event(body: schemas.CalendarEventCreate, db: Session = Depends(get_db)):
    # Resolve profile objects
    profiles: list[models.Profile] = []
    if body.profile_ids:
        profiles = (
            db.query(models.Profile)
            .filter(models.Profile.id.in_(body.profile_ids))
            .all()
        )
        if len(profiles) != len(set(body.profile_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more profile_ids are invalid",
            )

    event = models.CalendarEvent(
        title=body.title,
        date=body.date,
        start_time=body.start_time,
        end_time=body.end_time,
        all_day=body.all_day,
        colour_override=body.colour_override,
        google_event_id=body.google_event_id,
        google_calendar_id=body.google_calendar_id,
        source=body.source,
        recurrence_rule=body.recurrence_rule,
    )
    event.profiles = profiles

    db.add(event)
    db.commit()
    db.refresh(event)

    # Re-query with joinedload so profiles are included in the response
    return _get_event_or_404(event.id, db)


# ---------------------------------------------------------------------------
# PUT /{event_id}  — full update event
# ---------------------------------------------------------------------------
@router.put("/{event_id}", response_model=schemas.CalendarEventResponse)
def update_event(event_id: int, body: schemas.CalendarEventCreate, db: Session = Depends(get_db)):
    event = _get_event_or_404(event_id, db)

    # Resolve updated profiles
    profiles: list[models.Profile] = []
    if body.profile_ids:
        profiles = (
            db.query(models.Profile)
            .filter(models.Profile.id.in_(body.profile_ids))
            .all()
        )
        if len(profiles) != len(set(body.profile_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more profile_ids are invalid",
            )

    event.title = body.title
    event.date = body.date
    event.start_time = body.start_time
    event.end_time = body.end_time
    event.all_day = body.all_day
    event.colour_override = body.colour_override
    event.google_event_id = body.google_event_id
    event.google_calendar_id = body.google_calendar_id
    event.source = body.source
    event.recurrence_rule = body.recurrence_rule
    event.profiles = profiles

    db.commit()
    db.refresh(event)

    return _get_event_or_404(event.id, db)


# ---------------------------------------------------------------------------
# PATCH /{event_id}  — partial update (used by frontend eventsApi.update)
# ---------------------------------------------------------------------------
@router.patch("/{event_id}", response_model=schemas.CalendarEventResponse)
def patch_event(event_id: int, body: schemas.CalendarEventCreate, db: Session = Depends(get_db)):
    event = _get_event_or_404(event_id, db)

    update_data = body.model_dump(exclude_unset=True)

    # Handle profile_ids separately (not a direct model column)
    new_profile_ids = update_data.pop("profile_ids", None)
    if new_profile_ids is not None:
        profiles = (
            db.query(models.Profile)
            .filter(models.Profile.id.in_(new_profile_ids))
            .all()
        )
        if len(profiles) != len(set(new_profile_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more profile_ids are invalid",
            )
        event.profiles = profiles

    for field, value in update_data.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)

    return _get_event_or_404(event.id, db)


# ---------------------------------------------------------------------------
# DELETE /{event_id}  — delete event
# ---------------------------------------------------------------------------
@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = (
        db.query(models.CalendarEvent)
        .filter(models.CalendarEvent.id == event_id)
        .first()
    )
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    db.delete(event)
    db.commit()
