# Odysseus Family Planner

A locally-hosted family organiser that lives on a Raspberry Pi and is accessible from any phone, tablet, or computer on your home network. Inspired by the Odysseus calendar — built entirely with open-source tools, no subscription required.

---

## Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Quick Start — Development](#quick-start--development)
4. [Raspberry Pi Deployment](#raspberry-pi-deployment)
5. [Google Calendar Setup](#google-calendar-setup)
6. [Development Guide](#development-guide)
7. [Maintenance](#maintenance)
8. [Architecture](#architecture)

---

## Overview

Odysseus Family Planner runs as a small web server on a Raspberry Pi plugged into your home network. Once it's running, every member of the family can open `http://odysseus.local` in a browser — on any device, no app install needed — and see the shared family calendar, tasks, chore screen, meal planner, and shopping lists.

Everything is stored locally in a SQLite database on the Pi. Your family's data never leaves your house. If you want, you can optionally connect each family member's Google Calendar so that personal events sync in automatically.

---

## Features

- **Family Calendar** — Month and week views showing events for every family member. Add, edit, and delete events. Colour-coded per person.
- **Tasks** — Shared task list with due dates, assignees, and completion tracking.
- **Chore Screen** — A simplified full-screen view designed for a wall-mounted tablet, showing today's chores and who is responsible for them.
- **Meal Planner** — Plan meals for the week. Assign breakfasts, lunches, and dinners per day.
- **Shopping & General Lists** — Create multiple lists (shopping, packing, etc.) with checkable items.
- **Google Calendar Sync** — Each family member can connect their Google account. Their personal Google Calendar events are pulled in automatically and displayed alongside family events.
- **Multi-profile** — Add one profile per family member, each with their own colour and avatar.
- **Fully local** — No cloud account required for core functionality. Works even without internet once set up.

---

## Quick Start — Development

If you want to run the app on your own PC to develop or try it out, follow these steps.

### Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer and npm

### 1. Clone the repository

```bash
git clone <your-repo-url> skylight
cd skylight
```

### 2. Start the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

The API is now running at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/docs`

### 3. Start the frontend (in a second terminal)

```bash
cd frontend
npm install
npm run dev
```

The app is now running at `http://localhost:3000`. API requests are proxied automatically to the backend.

### 4. Environment variables (optional for development)

Copy the example file and fill in values if you want Google Calendar sync:

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your preferred text editor
```

The app works fine without the `.env` file — Google Calendar sync just won't be available until the credentials are added.

---

## Raspberry Pi Deployment

This is the intended way to run Odysseus permanently. The setup script handles everything in one go.

### Prerequisites

- Raspberry Pi 3, 4, or 5
- Raspberry Pi OS (Bookworm or Bullseye, 32-bit or 64-bit)
- The Pi connected to your home network via ethernet or Wi-Fi
- SSH access to the Pi, or a keyboard and monitor plugged in

### Step 1 — Get the project onto the Pi

**Option A — Copy from your PC using `scp`:**

```bash
# Run this on your PC (not the Pi), from the parent directory of the project
scp -r "skylight clone" pi@<pi-ip-address>:/home/pi/skylight
```

**Option B — Clone from a git remote directly on the Pi:**

```bash
# Run this on the Pi
git clone <your-repo-url> /home/pi/skylight
```

**Option C — USB drive:**

Copy the project folder to a USB drive, plug it into the Pi, then copy it across:

```bash
# On the Pi
cp -r /media/pi/<your-usb>/skylight-clone /home/pi/skylight
```

### Step 2 — Run the setup script

SSH into the Pi (or open a terminal on it directly) and run:

```bash
cd /home/pi/skylight
chmod +x deploy/setup-pi.sh
./deploy/setup-pi.sh
```

The script will:

1. Install system packages (Python, Node.js, nginx, avahi-daemon)
2. Enable mDNS so the Pi is reachable at `odysseus.local`
3. Set the Pi's hostname to `skylight`
4. Create a Python virtual environment and install backend dependencies
5. Build the React frontend
6. Create `backend/.env` from the example file (if it doesn't exist yet)
7. Install and start the `skylight` systemd service (auto-starts on boot)
8. Configure nginx as a reverse proxy on port 80

The whole process takes about 3–5 minutes on a Pi 4, a bit longer on a Pi 3.

### Step 3 — Add your environment values

The setup script creates `backend/.env` but leaves the placeholder values in place. Open it and fill in at least a `SECRET_KEY`:

```bash
nano /home/pi/skylight/backend/.env
```

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SECRET_KEY=some-long-random-string-change-this
DATABASE_URL=sqlite:///./data/skylight.db
```

The `SECRET_KEY` can be any long random string — it's used for session security. Generate one with:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

The Google credentials are optional. If you skip them, the app works fully except Google Calendar sync won't be available. See [Google Calendar Setup](#google-calendar-setup) for how to get them.

After editing `.env`, restart the service:

```bash
sudo systemctl restart skylight
```

### Step 4 — Open the app

On any device connected to the same home network, open a browser and go to:

```
http://odysseus.local
```

If `.local` doesn't resolve yet (it can take a minute after first boot), use the Pi's IP address directly:

```
http://192.168.x.x
```

Find the IP with: `hostname -I` on the Pi.

> **Tip for a wall-mounted display:** Set the browser to open `http://odysseus.local/chore-screen` on startup for a clean always-on chore display.

### Troubleshooting

**The page doesn't load:**
```bash
sudo systemctl status skylight        # Is the backend running?
sudo systemctl status nginx           # Is nginx running?
sudo journalctl -u skylight -n 50     # Any errors in the backend?
```

**`odysseus.local` doesn't resolve:**

Try rebooting the Pi (`sudo reboot`). On Windows PCs, mDNS requires Apple Bonjour or compatible software — it usually works out of the box on macOS, iOS, Android, and recent Windows 11.

**Port 80 already in use:**
```bash
sudo systemctl stop apache2           # Remove Apache if it's installed
sudo systemctl disable apache2
sudo systemctl restart nginx
```

---

## Google Calendar Setup

This is optional. Skip it if you don't want to sync with Google Calendar.

Each family member can connect their own Google account and have their personal calendar events appear in Odysseus automatically.

### Step 1 — Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in.
2. Click the project picker at the top, then **New Project**.
3. Give it a name like `Odysseus Family` and click **Create**.

### Step 2 — Enable the Google Calendar API

1. In your new project, go to **APIs & Services → Library**.
2. Search for `Google Calendar API` and click on it.
3. Click **Enable**.

### Step 3 — Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose **External** and click **Create**.
3. Fill in:
   - **App name:** `Odysseus Family Planner`
   - **User support email:** your email address
   - **Developer contact:** your email address
4. Click **Save and Continue** through the remaining steps (Scopes and Test Users — you can leave these as defaults).
5. On the **Test Users** step, add the email addresses of every Google account you want to connect. (While the app is in "Testing" mode, only listed users can authorise it.)

### Step 4 — Create OAuth 2.0 credentials

1. Go to **APIs & Services → Credentials**.
2. Click **+ Create Credentials → OAuth client ID**.
3. Choose **Web application** as the application type.
4. Give it a name (e.g. `Odysseus Web`).
5. Under **Authorised redirect URIs**, add:
   ```
   http://odysseus.local/api/google-calendar/callback
   ```
   If you also want to test from your development PC, add a second URI:
   ```
   http://localhost:8000/api/google-calendar/callback
   ```
6. Click **Create**.

Google will show you a **Client ID** and **Client Secret**. Copy both — you'll need them in the next step.

### Step 5 — Add credentials to the Pi

SSH into the Pi and edit the `.env` file:

```bash
nano /home/pi/skylight/backend/.env
```

Paste in your values:

```env
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
```

Restart the service:

```bash
sudo systemctl restart skylight
```

### Step 6 — Connect each family member's account

1. Open Odysseus in a browser (`http://odysseus.local`).
2. Go to **Settings**.
3. For each family member, click **Connect Google Calendar**.
4. Follow the Google sign-in flow. After authorising, their calendar events will start syncing automatically.

---

## Development Guide

### Running backend and frontend separately

The backend and frontend are developed independently. In development mode, the frontend dev server handles hot-module replacement and proxies API requests to the backend.

**Terminal 1 — Backend:**

```bash
cd backend
source venv/bin/activate          # Windows: venv\Scripts\activate
DEV=true python run.py            # DEV=true enables auto-reload on file changes
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`. The Vite proxy config in `vite.config.ts` forwards `/api/*` requests to `http://localhost:8000` automatically.

### Production build (test locally before deploying)

```bash
cd frontend
npm run build                     # Produces frontend/dist/

cd ../backend
python run.py                     # Now serves the built frontend at http://localhost:8000
```

### Project structure

```
skylight/
├── backend/
│   ├── app/
│   │   ├── main.py              FastAPI app, CORS, router registration, SPA fallback
│   │   ├── database.py          SQLAlchemy engine, session factory, Base class
│   │   ├── models.py            ORM models (Profile, CalendarEvent, Task, Meal, List…)
│   │   ├── schemas.py           Pydantic v2 request/response schemas
│   │   ├── sync_service.py      Background Google Calendar sync loop
│   │   └── routers/
│   │       ├── profiles.py
│   │       ├── events.py
│   │       ├── tasks.py
│   │       ├── meals.py
│   │       ├── lists.py
│   │       └── google_calendar.py
│   ├── data/                    SQLite database (gitignored, created on first run)
│   ├── requirements.txt
│   ├── .env.example
│   └── run.py                   Uvicorn entry point (binds 0.0.0.0:8000)
├── frontend/
│   ├── src/
│   │   ├── api/                 Axios instance + typed API helper functions
│   │   ├── components/          Shared UI components
│   │   ├── contexts/            React context providers
│   │   ├── pages/               One component per route (Calendar, Tasks, etc.)
│   │   └── types/               TypeScript interfaces matching backend schemas
│   ├── vite.config.ts           Dev proxy config + build output to frontend/dist/
│   └── package.json
└── deploy/
    ├── odysseus.service         systemd unit file
    ├── setup-pi.sh              One-time setup script
    ├── update.sh                Update script (re-build + restart)
    └── nginx.conf               nginx reverse proxy config
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | Yes (production) | Long random string used for session security |
| `GOOGLE_CLIENT_ID` | No | OAuth client ID for Google Calendar sync |
| `GOOGLE_CLIENT_SECRET` | No | OAuth client secret for Google Calendar sync |
| `DATABASE_URL` | No | Defaults to `sqlite:///./data/skylight.db` |
| `PORT` | No | HTTP port for uvicorn. Defaults to `8000` |
| `DEV` | No | Set to `true` to enable uvicorn auto-reload |

---

## Maintenance

### Checking the service

```bash
sudo systemctl status skylight          # Is it running?
sudo journalctl -u skylight -f          # Stream live logs
sudo journalctl -u skylight -n 100      # Last 100 log lines
```

### Restarting the service

```bash
sudo systemctl restart skylight
```

### Updating the app

After copying new files to the Pi (via `scp`, USB, or `git pull`), run the update script:

```bash
cd /home/pi/skylight
./deploy/update.sh
```

This re-installs Python dependencies, rebuilds the frontend, and restarts the service.

### Backing up the database

The SQLite database lives at `backend/data/skylight.db`. Copy it somewhere safe:

```bash
cp /home/pi/skylight/backend/data/skylight.db ~/skylight-backup-$(date +%Y%m%d).db
```

You can automate this with a cron job:

```bash
crontab -e
# Add this line to back up every night at 2am:
0 2 * * * cp /home/pi/skylight/backend/data/skylight.db /home/pi/backups/skylight-$(date +\%Y\%m\%d).db
```

### Changing the install directory

If you installed to somewhere other than `/home/pi/skylight`, the setup script handles the path substitution automatically. If you need to change it after the fact:

```bash
sudo nano /etc/systemd/system/odysseus.service
# Update WorkingDirectory, EnvironmentFile, and ExecStart paths
sudo systemctl daemon-reload
sudo systemctl restart skylight
```

---

## Architecture

Odysseus is a straightforward two-tier web app with no external services required.

| Layer | Technology | Notes |
|---|---|---|
| **Backend API** | [FastAPI](https://fastapi.tiangolo.com/) + [uvicorn](https://www.uvicorn.org/) | Python 3.11+. Runs on port 8000. Serves the built frontend in production. |
| **Database** | SQLite via [SQLAlchemy](https://www.sqlalchemy.org/) | Single file on disk. Zero config. Fine for a family's data volume. |
| **Frontend** | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Built with [Vite](https://vitejs.dev/). |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Utility-first. No component library dependency. |
| **HTTP routing** | [React Router v6](https://reactrouter.com/) | Client-side routing; FastAPI catches all unmatched routes and returns `index.html`. |
| **Google sync** | [Google API Python Client](https://github.com/googleapis/google-api-python-client) | OAuth 2.0 flow per user. Background sync loop polls for changes. |
| **Reverse proxy** | [nginx](https://nginx.org/) | Sits in front of uvicorn on port 80. Handles `odysseus.local` name resolution. |
| **Process manager** | systemd | Starts on boot, restarts on crash. |

**Request flow (production):**

```
Browser (any device on local network)
  → nginx :80
    → uvicorn :8000 (FastAPI)
      → /api/*  handled by FastAPI routers
      → /*      returns frontend/dist/index.html (React SPA takes over)
```
