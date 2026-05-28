"""
Pydantic v2 schemas for the Skylight Family Planner.

Each resource has:
- A `Create` schema for input (POST/PUT bodies)
- A `Response` schema for output (with from_attributes = True for ORM compatibility)
"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
class ProfileCreate(BaseModel):
    name: str
    colour: str
    avatar_emoji: str = "👤"
    google_calendar_id: Optional[str] = None


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    colour: str
    avatar_emoji: str
    google_calendar_id: Optional[str] = None
    # google_token_json is intentionally excluded from the response for security
    created_at: datetime


# ---------------------------------------------------------------------------
# CalendarEvent
# ---------------------------------------------------------------------------
class CalendarEventCreate(BaseModel):
    title: str
    date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    all_day: bool = False
    colour_override: Optional[str] = None
    google_event_id: Optional[str] = None
    google_calendar_id: Optional[str] = None
    source: str = "local"
    profile_ids: List[int] = []
    recurrence_rule: Optional[str] = None


class CalendarEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    all_day: bool
    colour_override: Optional[str] = None
    google_event_id: Optional[str] = None
    google_calendar_id: Optional[str] = None
    source: str
    recurrence_rule: Optional[str] = None
    is_recurring_instance: bool = False
    recurrence_source_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    profiles: List[ProfileResponse] = []


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------
class TaskCreate(BaseModel):
    title: str
    due_date: Optional[date] = None
    completed: bool = False
    profile_id: int
    subject_profile_id: Optional[int] = None
    recurrence_rule: Optional[str] = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    due_date: Optional[date] = None
    completed: bool
    completed_at: Optional[datetime] = None
    profile_id: int
    profile: Optional[ProfileResponse] = None
    subject_profile_id: Optional[int] = None
    subject_profile: Optional['ProfileResponse'] = None
    recurrence_rule: Optional[str] = None
    created_at: datetime
    is_overdue: bool = False


# ---------------------------------------------------------------------------
# MealPlan
# ---------------------------------------------------------------------------
class MealPlanCreate(BaseModel):
    date: date
    meal_type: str   # "breakfast" | "lunch" | "dinner"
    description: str


class MealPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    meal_type: str
    description: str


# ---------------------------------------------------------------------------
# ListItem
# ---------------------------------------------------------------------------
class ListItemCreate(BaseModel):
    text: str
    checked: bool = False
    position: int = 0


class ListItemUpdate(BaseModel):
    """Used for PATCH — all fields optional so partial updates work correctly."""
    text: Optional[str] = None
    checked: Optional[bool] = None
    position: Optional[int] = None


class ListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    list_id: int
    text: str
    checked: bool
    position: int
    created_at: datetime


# ---------------------------------------------------------------------------
# CustomList
# ---------------------------------------------------------------------------
class CustomListCreate(BaseModel):
    name: str
    colour: Optional[str] = None


class CustomListUpdate(BaseModel):
    """Used for PATCH — all fields optional so partial updates work correctly."""
    name: Optional[str] = None
    colour: Optional[str] = None


class CustomListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    colour: Optional[str] = None
    created_at: datetime
    items: List[ListItemResponse] = []


# ---------------------------------------------------------------------------
# Recipe
# ---------------------------------------------------------------------------
class RecipeIngredientCreate(BaseModel):
    text: str
    position: int = 0


class RecipeIngredientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    recipe_id: int
    text: str
    position: int
    created_at: datetime


class RecipeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    servings: Optional[int] = None
    notes: Optional[str] = None
    ingredients: List[RecipeIngredientCreate] = []


class RecipeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    servings: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime
    ingredients: List[RecipeIngredientResponse] = []


# ---------------------------------------------------------------------------
# Routines
# ---------------------------------------------------------------------------
class RoutineItemCreate(BaseModel):
    text: str
    position: int = 0


class RoutineItemUpdate(BaseModel):
    text: Optional[str] = None
    position: Optional[int] = None


class RoutineItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    routine_id: int
    text: str
    position: int
    created_at: datetime


class RoutineItemTodayResponse(BaseModel):
    id: int
    routine_id: int
    text: str
    position: int
    completed_today: bool


class RoutineStreakInfo(BaseModel):
    current_streak: int = 0
    longest_streak: int = 0
    last_complete_date: Optional[date] = None


class RoutineSlotResponse(BaseModel):
    slot: str
    routine_id: int
    items: List[RoutineItemTodayResponse]
    streak: RoutineStreakInfo
    slot_complete: bool
    history: List[bool]


class RoutineTodayResponse(BaseModel):
    date: str
    slots: List[RoutineSlotResponse]
    perfect_day: bool


class RoutineToggleResponse(BaseModel):
    item_id: int
    completed: bool
    slot_complete: bool
