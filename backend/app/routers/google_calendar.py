"""
Google Calendar integration router.

Provides OAuth2 authorization, sync, status and disconnect endpoints.
Each Profile can link its own Google Calendar. Once linked, events are
pulled from Google (source='google') and local events are pushed back.
"""

import json
import logging
import os
from datetime import datetime, timedelta, timezone, date as date_type, time as time_type

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models import Profile, CalendarEvent, event_profiles

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Configuration helpers
# ---------------------------------------------------------------------------

SCOPES = ["https://www.googleapis.com/auth/calendar"]
REDIRECT_URI = "http://localhost:8000/api/google-calendar/callback"


def _get_flow(state: str | None = None):
    """
    Build an OAuth2 Flow from environment variables.
    Raises HTTPException 503 if credentials are not configured.
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=503,
            detail=(
                "Google Calendar not configured. "
                "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env"
            ),
        )

    from google_auth_oauthlib.flow import Flow  # type: ignore

    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [REDIRECT_URI],
        }
    }

    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
        state=state,
    )
    return flow


def build_google_service(token_json: str):
    """
    Build an authenticated Google Calendar service from a stored token JSON string.
    Refreshes the token if it is expired.
    Returns the service object, and also returns the (possibly refreshed) token JSON
    so the caller can persist it.
    """
    from google.oauth2.credentials import Credentials  # type: ignore
    from google.auth.transport.requests import Request  # type: ignore
    from googleapiclient.discovery import build  # type: ignore

    creds = Credentials.from_authorized_user_json(token_json, scopes=SCOPES)

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())

    service = build("calendar", "v3", credentials=creds)
    # Return service + refreshed token JSON (may be unchanged if not expired)
    refreshed_token_json = creds.to_json()
    return service, refreshed_token_json


# ---------------------------------------------------------------------------
# Event mapping helpers
# ---------------------------------------------------------------------------

def _google_event_to_local(g_event: dict, profile: Profile) -> dict:
    """
    Convert a Google Calendar event dict into kwargs for CalendarEvent creation/update.
    """
    title = g_event.get("summary", "(No title)")
    google_event_id = g_event["id"]
    google_calendar_id = profile.google_calendar_id or "primary"

    start = g_event.get("start", {})
    end = g_event.get("end", {})

    if "date" in start:
        # All-day event
        event_date = date_type.fromisoformat(start["date"])
        start_time = None
        end_time = None
        all_day = True
    else:
        # Timed event — dateTime is RFC3339
        dt_str = start.get("dateTime", "")
        # Strip timezone info for naive parsing if needed
        try:
            dt = datetime.fromisoformat(dt_str)
        except ValueError:
            dt = datetime.utcnow()
        event_date = dt.date()
        start_time = dt.time().replace(tzinfo=None)

        end_dt_str = end.get("dateTime", "")
        try:
            end_dt = datetime.fromisoformat(end_dt_str)
            end_time = end_dt.time().replace(tzinfo=None)
        except (ValueError, AttributeError):
            end_time = None

        all_day = False

    return {
        "title": title,
        "date": event_date,
        "start_time": start_time,
        "end_time": end_time,
        "all_day": all_day,
        "google_event_id": google_event_id,
        "google_calendar_id": google_calendar_id,
        "source": "google",
    }


def _local_event_to_google(event: CalendarEvent) -> dict:
    """
    Convert a local CalendarEvent into a Google Calendar event body dict.
    """
    body: dict = {"summary": event.title}

    if event.all_day or event.start_time is None:
        body["start"] = {"date": event.date.isoformat()}
        body["end"] = {"date": event.date.isoformat()}
    else:
        # Build RFC3339 datetime strings (no timezone — treat as local/UTC)
        start_dt = datetime.combine(event.date, event.start_time)
        body["start"] = {"dateTime": start_dt.isoformat(), "timeZone": "UTC"}

        if event.end_time:
            end_dt = datetime.combine(event.date, event.end_time)
        else:
            end_dt = start_dt + timedelta(hours=1)
        body["end"] = {"dateTime": end_dt.isoformat(), "timeZone": "UTC"}

    return body


# ---------------------------------------------------------------------------
# Core sync logic
# ---------------------------------------------------------------------------

def sync_profile_calendar(profile_id: int, db: Session) -> dict:
    """
    Synchronise a single profile's Google Calendar (synchronous, accepts a DB session).

    PULL  Google → Skylight:
      - Fetch events in the window [now-30d, now+90d]
      - Upsert local CalendarEvent rows keyed on google_event_id
      - Delete local google-source events that no longer exist in Google

    PUSH  Skylight → Google:
      - Find local-source events assigned to this profile that have no google_event_id
      - Insert them into Google Calendar and store the returned ID
    """
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile or not profile.google_token_json:
        raise ValueError(f"Profile {profile_id} has no Google token")

    service, refreshed_token = build_google_service(profile.google_token_json)

    # Persist refreshed token if it changed
    if refreshed_token != profile.google_token_json:
        profile.google_token_json = refreshed_token
        db.commit()

    calendar_id = profile.google_calendar_id or "primary"

    now = datetime.now(timezone.utc)
    time_min = (now - timedelta(days=30)).isoformat()
    time_max = (now + timedelta(days=90)).isoformat()

    # -----------------------------------------------------------------------
    # PULL — Google → Skylight
    # -----------------------------------------------------------------------
    pulled_count = 0
    google_event_ids_seen: set[str] = set()

    page_token = None
    while True:
        kwargs: dict = dict(
            calendarId=calendar_id,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
            maxResults=250,
        )
        if page_token:
            kwargs["pageToken"] = page_token

        response = service.events().list(**kwargs).execute()
        items = response.get("items", [])

        for g_event in items:
            g_id = g_event["id"]
            google_event_ids_seen.add(g_id)

            local_event = (
                db.query(CalendarEvent)
                .filter(CalendarEvent.google_event_id == g_id)
                .first()
            )

            mapped = _google_event_to_local(g_event, profile)

            if local_event:
                # Update existing
                for field, value in mapped.items():
                    setattr(local_event, field, value)
            else:
                # Create new
                local_event = CalendarEvent(**mapped)
                db.add(local_event)
                db.flush()  # get the id before appending to relationship
                local_event.profiles.append(profile)
                pulled_count += 1

        page_token = response.get("nextPageToken")
        if not page_token:
            break

    db.commit()

    # Delete local google-source events for this profile that no longer exist in Google
    stale_events = (
        db.query(CalendarEvent)
        .join(event_profiles, CalendarEvent.id == event_profiles.c.event_id)
        .filter(
            event_profiles.c.profile_id == profile_id,
            CalendarEvent.source == "google",
            CalendarEvent.google_event_id.notin_(google_event_ids_seen)
            if google_event_ids_seen
            else CalendarEvent.source == "google",
        )
        .all()
    )

    for stale in stale_events:
        db.delete(stale)
    db.commit()

    # -----------------------------------------------------------------------
    # PUSH — Skylight → Google
    # -----------------------------------------------------------------------
    pushed_count = 0

    local_events_to_push = (
        db.query(CalendarEvent)
        .join(event_profiles, CalendarEvent.id == event_profiles.c.event_id)
        .filter(
            event_profiles.c.profile_id == profile_id,
            CalendarEvent.source == "local",
            CalendarEvent.google_event_id.is_(None),
        )
        .all()
    )

    for local_event in local_events_to_push:
        try:
            body = _local_event_to_google(local_event)
            created = (
                service.events()
                .insert(calendarId=calendar_id, body=body)
                .execute()
            )
            local_event.google_event_id = created["id"]
            local_event.google_calendar_id = calendar_id
            pushed_count += 1
        except Exception as exc:
            logger.warning(
                "Failed to push event %d to Google Calendar: %s", local_event.id, exc
            )

    db.commit()

    return {"synced_events": pulled_count, "pushed_events": pushed_count}


def sync_profile_calendar_sync(profile_id: int) -> dict:
    """
    Synchronous wrapper that creates its own DB session.
    Intended for use with asyncio.to_thread() from the background sync service.
    """
    db = SessionLocal()
    try:
        return sync_profile_calendar(profile_id, db)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/auth/{profile_id}")
def start_oauth(profile_id: int, db: Session = Depends(get_db)):
    """
    Begin the OAuth2 flow for a profile.
    Returns {"auth_url": "..."} — the frontend should open this URL.
    """
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    flow = _get_flow(state=str(profile_id))
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # ensure refresh_token is returned on every auth
    )
    return {"auth_url": auth_url}


@router.get("/callback")
def oauth_callback(code: str, state: str, db: Session = Depends(get_db)):
    """
    OAuth2 callback. Exchanges the auth code for tokens and stores them on the profile.
    Redirects the browser to /?google_auth=success (or error).
    """
    try:
        profile_id = int(state)
    except (ValueError, TypeError):
        return RedirectResponse("/?google_auth=error&reason=invalid_state")

    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        return RedirectResponse("/?google_auth=error&reason=profile_not_found")

    try:
        flow = _get_flow(state=state)
        flow.fetch_token(code=code)
        creds = flow.credentials

        # Discover the user's primary calendar ID
        from googleapiclient.discovery import build  # type: ignore

        service = build("calendar", "v3", credentials=creds)
        calendar_list = service.calendarList().get(calendarId="primary").execute()
        calendar_id = calendar_list.get("id", "primary")

        profile.google_token_json = creds.to_json()
        profile.google_calendar_id = calendar_id
        db.commit()

    except HTTPException:
        return RedirectResponse("/?google_auth=error&reason=not_configured")
    except Exception as exc:
        logger.error("OAuth callback error for profile %d: %s", profile_id, exc)
        return RedirectResponse(f"/?google_auth=error&reason=token_exchange_failed")

    return RedirectResponse("/?google_auth=success")


@router.get("/status/{profile_id}")
def get_status(profile_id: int, db: Session = Depends(get_db)):
    """
    Returns the Google Calendar sync status for a profile.
    {"connected": bool, "calendar_id": str|null, "last_sync": str|null}
    """
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    connected = profile.google_token_json is not None
    return {
        "connected": connected,
        "calendar_id": profile.google_calendar_id if connected else None,
        "last_sync": None,  # populated by sync_service if needed
    }


@router.post("/sync/{profile_id}")
def manual_sync(profile_id: int, db: Session = Depends(get_db)):
    """
    Manually trigger a sync for a single profile.
    Returns {"synced_events": int, "pushed_events": int}.
    """
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if not profile.google_token_json:
        raise HTTPException(
            status_code=400,
            detail="Profile is not connected to Google Calendar",
        )

    try:
        result = sync_profile_calendar(profile_id, db)
    except Exception as exc:
        logger.error("Manual sync failed for profile %d: %s", profile_id, exc)
        raise HTTPException(status_code=500, detail=f"Sync failed: {exc}")

    return result


@router.delete("/disconnect/{profile_id}")
def disconnect(profile_id: int, db: Session = Depends(get_db)):
    """
    Remove the Google Calendar link from a profile.
    Clears token + calendar_id, and deletes all google-source events for this profile.
    """
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Find and delete all google-source events linked to this profile
    google_events = (
        db.query(CalendarEvent)
        .join(event_profiles, CalendarEvent.id == event_profiles.c.event_id)
        .filter(
            event_profiles.c.profile_id == profile_id,
            CalendarEvent.source == "google",
        )
        .all()
    )
    for ev in google_events:
        db.delete(ev)

    profile.google_token_json = None
    profile.google_calendar_id = None
    db.commit()

    return {"disconnected": True, "deleted_events": len(google_events)}
