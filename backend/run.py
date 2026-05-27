"""
Entry point for running the Skylight Family Planner backend.

Run with:
    python run.py

Binds to 0.0.0.0:8000 so it is accessible from other devices on the local network
(required for Raspberry Pi deployment and accessing from phones/tablets).
"""

import os
from pathlib import Path

# Load .env file if present (for GOOGLE_CLIENT_ID, etc.)
try:
    from dotenv import load_dotenv
    _env_file = Path(__file__).parent / ".env"
    if _env_file.exists():
        load_dotenv(_env_file)
except ImportError:
    pass  # python-dotenv not installed; environment variables must be set manually

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("DEV", "false").lower() == "true",
        log_level="info",
    )
