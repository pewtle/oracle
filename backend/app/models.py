"""
SQLAlchemy ORM models for the Skylight Family Planner.
"""

from datetime import datetime, date, time
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Date,
    Time,
    DateTime,
    ForeignKey,
    Table,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Association table: many-to-many between CalendarEvent and Profile
# ---------------------------------------------------------------------------
event_profiles = Table(
    "event_profiles",
    Base.metadata,
    Column("event_id", Integer, ForeignKey("calendar_events.id", ondelete="CASCADE"), primary_key=True),
    Column("profile_id", Integer, ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True),
)


# ---------------------------------------------------------------------------
# Profile — represents a family member (human or pet)
# ---------------------------------------------------------------------------
class Profile(Base):
    __tablename__ = "profiles"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    name: str = Column(String, nullable=False)
    colour: str = Column(String, nullable=False)          # hex colour, e.g. "#FF5733"
    avatar_emoji: str = Column(String, default="👤")
    google_calendar_id: str | None = Column(String, nullable=True)
    google_token_json: str | None = Column(String, nullable=True)  # serialised OAuth token JSON
    created_at: datetime = Column(DateTime, default=func.now())

    # Relationships
    events = relationship("CalendarEvent", secondary=event_profiles, back_populates="profiles")
    tasks = relationship("Task", foreign_keys="[Task.profile_id]", back_populates="profile", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# CalendarEvent — a calendar event, optionally synced from Google Calendar
# ---------------------------------------------------------------------------
class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    title: str = Column(String, nullable=False)
    date: date = Column(Date, nullable=False)
    start_time: time | None = Column(Time, nullable=True)   # null → all-day
    end_time: time | None = Column(Time, nullable=True)
    all_day: bool = Column(Boolean, default=False)
    colour_override: str | None = Column(String, nullable=True)  # if None, use profiles' colours
    google_event_id: str | None = Column(String, nullable=True)
    google_calendar_id: str | None = Column(String, nullable=True)
    source: str = Column(String, default="local")           # "local" or "google"
    recurrence_rule: str | None = Column(String, nullable=True)
    # recurrence_rule: JSON string {"frequency": "daily"|"weekly", "days": ["mon","wed","fri"]}
    # null means no recurrence
    created_at: datetime = Column(DateTime, default=func.now())
    updated_at: datetime = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    profiles = relationship("Profile", secondary=event_profiles, back_populates="events")


# ---------------------------------------------------------------------------
# Task — a to-do item assigned to a family member
# DB was regenerated on 2026-05-27 to add subject_profile_id and recurrence_rule
# ---------------------------------------------------------------------------
class Task(Base):
    __tablename__ = "tasks"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    title: str = Column(String, nullable=False)
    due_date: date | None = Column(Date, nullable=True)
    completed: bool = Column(Boolean, default=False)
    completed_at: datetime | None = Column(DateTime, nullable=True)
    profile_id: int = Column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    subject_profile_id: int | None = Column(Integer, ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    # subject_profile_id is WHO/WHAT the task is about (e.g. the dog)
    # profile_id is WHO is responsible for completing it
    recurrence_rule: str | None = Column(String, nullable=True)
    # JSON: {"frequency": "daily"|"weekly", "days": ["mon","tue",...]}
    created_at: datetime = Column(DateTime, default=func.now())

    # Relationships
    profile = relationship("Profile", foreign_keys=[profile_id], back_populates="tasks")
    subject_profile = relationship("Profile", foreign_keys=[subject_profile_id])


# ---------------------------------------------------------------------------
# Recipe + RecipeIngredient — recipe book
# ---------------------------------------------------------------------------
class Recipe(Base):
    __tablename__ = "recipes"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    title: str = Column(String, nullable=False)
    description: str | None = Column(String, nullable=True)
    servings: int | None = Column(Integer, nullable=True)
    notes: str | None = Column(String, nullable=True)
    created_at: datetime = Column(DateTime, default=func.now())

    ingredients = relationship(
        "RecipeIngredient",
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="RecipeIngredient.position",
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    recipe_id: int = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    text: str = Column(String, nullable=False)  # e.g. "200g plain flour"
    position: int = Column(Integer, default=0)
    created_at: datetime = Column(DateTime, default=func.now())

    recipe = relationship("Recipe", back_populates="ingredients")


# ---------------------------------------------------------------------------
# MealPlan — a meal entry for a specific date and meal slot
# ---------------------------------------------------------------------------
class MealPlan(Base):
    __tablename__ = "meal_plans"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    date: date = Column(Date, nullable=False)
    meal_type: str = Column(String, nullable=False)   # "breakfast", "lunch", or "dinner"
    description: str = Column(String, nullable=False)

    __table_args__ = (
        UniqueConstraint("date", "meal_type", name="uq_meal_date_type"),
    )


# ---------------------------------------------------------------------------
# CustomList + ListItem — shopping/todo lists with ordered items
# ---------------------------------------------------------------------------
class CustomList(Base):
    __tablename__ = "custom_lists"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    name: str = Column(String, nullable=False)
    colour: str | None = Column(String, nullable=True)   # optional hex colour
    created_at: datetime = Column(DateTime, default=func.now())

    # Relationships
    items = relationship(
        "ListItem",
        back_populates="custom_list",
        cascade="all, delete-orphan",
        order_by="ListItem.position",
    )


class ListItem(Base):
    __tablename__ = "list_items"

    id: int = Column(Integer, primary_key=True, autoincrement=True)
    list_id: int = Column(Integer, ForeignKey("custom_lists.id", ondelete="CASCADE"), nullable=False)
    text: str = Column(String, nullable=False)
    checked: bool = Column(Boolean, default=False)
    position: int = Column(Integer, default=0)
    created_at: datetime = Column(DateTime, default=func.now())

    # Relationships
    custom_list = relationship("CustomList", back_populates="items")
