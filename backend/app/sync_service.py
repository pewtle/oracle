"""
Background sync service for Google Calendar integration.

SyncService runs a loop every 10 minutes, finding all profiles that have
a google_token_json set and syncing their calendars.

Usage (in main.py lifespan):
    from app.sync_service import sync_service

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db()
        await sync_service.start()
        yield
        await sync_service.stop()
"""

import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class SyncService:
    def __init__(self):
        self.running = False
        # Maps profile_id → datetime of last successful sync
        self.last_sync: dict[int, datetime] = {}

    async def start(self):
        """Start the background sync loop. Call this from main.py lifespan."""
        self.running = True
        asyncio.create_task(self._sync_loop())
        logger.info("Google Calendar sync service started (interval: 10 minutes)")

    async def stop(self):
        """Signal the sync loop to stop after the current iteration."""
        self.running = False
        logger.info("Google Calendar sync service stopping")

    async def _sync_loop(self):
        """Main loop: sync all connected profiles, then sleep 10 minutes."""
        while self.running:
            try:
                await self._sync_all_profiles()
            except Exception as exc:
                logger.error("Sync loop encountered an unexpected error: %s", exc)
            # Sleep 10 minutes between passes; check running flag each second
            # so stop() is honoured promptly.
            for _ in range(600):
                if not self.running:
                    return
                await asyncio.sleep(1)

    async def _sync_all_profiles(self):
        """
        Query all profiles that have google_token_json set and sync each one
        using asyncio.to_thread so the synchronous Google API calls don't block
        the event loop.
        """
        from app.database import SessionLocal
        from app.models import Profile

        # Fetch profile IDs in a short-lived session
        with SessionLocal() as db:
            profiles = (
                db.query(Profile)
                .filter(Profile.google_token_json.isnot(None))
                .all()
            )
            profile_ids = [p.id for p in profiles]

        if not profile_ids:
            return

        logger.info("Starting background sync for %d profile(s)", len(profile_ids))

        from app.routers.google_calendar import sync_profile_calendar_sync

        for profile_id in profile_ids:
            try:
                result = await asyncio.to_thread(
                    sync_profile_calendar_sync, profile_id
                )
                self.last_sync[profile_id] = datetime.utcnow()
                logger.info(
                    "Background sync completed for profile %d: %s",
                    profile_id,
                    result,
                )
            except Exception as exc:
                logger.error(
                    "Background sync failed for profile %d: %s", profile_id, exc
                )


# Singleton instance — imported by main.py
sync_service = SyncService()
