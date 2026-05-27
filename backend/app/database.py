"""
Database configuration using SQLAlchemy 2.0 style.
The SQLite file is created at ./data/skylight.db relative to where run.py is launched.
"""

import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Resolve database path relative to the backend root (where run.py lives)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_DATA_DIR = _BACKEND_ROOT / "data"
_DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_DATA_DIR / 'skylight.db'}")

# connect_args required for SQLite to allow cross-thread use (FastAPI runs in threads)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a database session and ensures it is closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables defined on Base. Safe to call multiple times."""
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _run_migrations()


def _run_migrations():
    """Additive schema migrations for SQLite (ALTER TABLE ADD COLUMN if missing)."""
    migrations = [
        ("tasks", "recurrence_rule", "TEXT"),
    ]
    with engine.connect() as conn:
        for table, column, col_type in migrations:
            result = conn.execute(
                __import__("sqlalchemy").text(f"PRAGMA table_info({table})")
            )
            existing = {row[1] for row in result}
            if column not in existing:
                conn.execute(
                    __import__("sqlalchemy").text(
                        f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"
                    )
                )
                conn.commit()
