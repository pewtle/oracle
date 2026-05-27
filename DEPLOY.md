# Odysseus — Raspberry Pi Deployment Guide

This guide takes you from a fresh Raspberry Pi OS install to a fully running Odysseus family planner accessible on your local network.

---

## Prerequisites

| What | Requirement |
|------|-------------|
| Hardware | Raspberry Pi 3B+ or Pi 4 (Pi 4 recommended) |
| OS | Raspberry Pi OS **Bookworm** or **Bullseye** (64-bit recommended) |
| Storage | microSD 8 GB+ (16 GB+ recommended) |
| Network | Pi connected to your home network (wired or Wi-Fi) |
| Access | SSH enabled, or keyboard + monitor attached |

---

## Step 1 — Flash and boot the Pi

1. Download **Raspberry Pi Imager** from https://www.raspberrypi.com/software/
2. Flash **Raspberry Pi OS Lite (64-bit)** or the full Desktop version to your SD card
3. In the Imager's advanced settings (click the gear icon):
   - Set a **hostname** (e.g. `odysseus`)
   - Enable **SSH**
   - Set your Wi-Fi credentials if using wireless
   - Set a username/password (default: `pi` / your chosen password)
4. Insert the SD card and boot the Pi

---

## Step 2 — Connect via SSH

From another machine on the same network:

```bash
ssh pi@odysseus.local
# or use the IP address if mDNS isn't working:
ssh pi@<PI_IP_ADDRESS>
```

---

## Step 3 — Update the system

```bash
sudo apt-get update && sudo apt-get upgrade -y
```

---

## Step 4 — Install Git and clone the repository

```bash
sudo apt-get install -y git

# Clone into /home/pi/odysseus  (or any directory you prefer)
git clone https://github.com/pewtle/oracle.git /home/pi/odysseus

cd /home/pi/odysseus
```

---

## Step 5 — Run the automated setup script

The setup script installs all dependencies, builds the frontend, configures nginx, and registers a systemd service so the app starts on boot.

```bash
chmod +x deploy/setup-pi.sh
./deploy/setup-pi.sh
```

**What it does:**

| Step | Action |
|------|--------|
| 1 | Installs `python3`, `pip`, `venv`, `nodejs`, `npm`, `nginx`, `avahi-daemon` |
| 2 | Enables avahi-daemon for `odysseus.local` mDNS resolution |
| 3 | Sets the Pi's hostname to `odysseus` |
| 4 | Creates a Python virtualenv and installs backend dependencies |
| 5 | Runs `npm install` and `npm run build` to produce the frontend bundle |
| 6 | Creates `backend/.env` from `.env.example` |
| 7 | Installs and starts the `odysseus` systemd service |
| 8 | Configures nginx as a reverse proxy on port 80 |

This step takes **5–10 minutes** on a Pi 4 (mostly the npm build).

---

## Step 6 — Configure environment variables

The setup script creates `backend/.env` automatically. Open it to fill in your values:

```bash
nano /home/pi/odysseus/backend/.env
```

```env
# Required — generate a long random string (used for session security)
SECRET_KEY=replace_this_with_a_long_random_string

# Optional — only needed for Google Calendar sync
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Optional — override where screensaver photos are stored
# Default is /home/pi/odysseus/backend/data/photos/
# PHOTOS_DIR=/home/pi/photos
```

Generate a secure `SECRET_KEY` with:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

After editing, restart the service:

```bash
sudo systemctl restart odysseus
```

---

## Step 7 — Open the app

| URL | Notes |
|-----|-------|
| `http://odysseus.local` | Works from any device on the network (mDNS) |
| `http://<PI_IP_ADDRESS>` | Works immediately if `.local` doesn't resolve yet |

Find the Pi's IP address with:

```bash
hostname -I
```

If `odysseus.local` doesn't resolve, try rebooting the Pi (`sudo reboot`) — mDNS sometimes needs a restart to propagate.

---

## Step 8 — Add screensaver photos (optional)

Drop `.jpg` or `.png` files into the photos directory:

```bash
# Default location
/home/pi/odysseus/backend/data/photos/

# Copy from another machine using scp:
scp ~/Pictures/family/*.jpg pi@odysseus.local:/home/pi/odysseus/backend/data/photos/
```

The screensaver activates automatically after 5 minutes of inactivity on the wall screen. Tap anywhere to return to the app.

---

## Step 9 — Set up Google Calendar sync (optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project
2. Enable the **Google Calendar API**
3. Create **OAuth 2.0 credentials** (type: Web application)
4. Add `http://odysseus.local/api/google-calendar/callback` as an authorised redirect URI
5. Copy the **Client ID** and **Client Secret** into `backend/.env`
6. Restart the service: `sudo systemctl restart odysseus`
7. Open the app → Settings → Connect Google Calendar

---

## Useful commands

```bash
# Check service status
sudo systemctl status odysseus

# View live logs
sudo journalctl -u odysseus -f

# Restart the service
sudo systemctl restart odysseus

# Stop the service
sudo systemctl stop odysseus
```

---

## Updating the app

When a new version is pushed to GitHub:

```bash
cd /home/pi/odysseus

# Pull the latest code
git pull

# Rebuild and restart
./deploy/update.sh
```

The update script reinstalls Python dependencies, rebuilds the frontend, and restarts the service. Takes 3–5 minutes.

---

## Auto-start on boot

The setup script registers a systemd service that starts Odysseus automatically whenever the Pi powers on. No manual intervention needed after initial setup.

To verify it's set to auto-start:

```bash
sudo systemctl is-enabled odysseus
# should output: enabled
```

---

## Troubleshooting

**App not loading at `odysseus.local`**
- Try the IP address directly: `http://<PI_IP>`
- Check nginx is running: `sudo systemctl status nginx`
- Check the app service: `sudo systemctl status odysseus`

**Service fails to start**
```bash
sudo journalctl -u odysseus -n 50 --no-pager
```
Look for Python import errors — most commonly a missing package. Fix with:
```bash
cd /home/pi/odysseus/backend
../venv/bin/pip install -r requirements.txt
sudo systemctl restart odysseus
```

**Frontend shows a blank page or 404**
- The frontend bundle may not have been built. Run:
```bash
cd /home/pi/odysseus/frontend && npm run build
sudo systemctl restart odysseus
```

**Port 80 already in use**
```bash
sudo systemctl stop apache2    # if Apache is installed
sudo systemctl disable apache2
sudo systemctl restart nginx
```

**Node.js version too old (npm build fails)**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```
Then re-run `./deploy/update.sh`.

---

## Directory structure on the Pi

```
/home/pi/odysseus/
├── backend/
│   ├── app/              # FastAPI application
│   ├── data/
│   │   ├── skylight.db   # SQLite database
│   │   └── photos/       # Screensaver images (add your own)
│   ├── .env              # Your secrets (never committed to git)
│   └── requirements.txt
├── frontend/
│   ├── src/              # React source
│   └── dist/             # Built bundle (served by nginx)
├── deploy/
│   ├── nginx.conf
│   ├── odysseus.service
│   ├── setup-pi.sh
│   └── update.sh
└── venv/                 # Python virtual environment
```

---

## Recommended Pi accessories for wall-mount use

- **Raspberry Pi 4** (2 GB RAM minimum, 4 GB preferred)
- **Official 7" touchscreen** or any HDMI monitor/tablet
- **Case with VESA mount** for clean wall installation
- Set the display to **not sleep**: `sudo raspi-config` → Display → Screen Blanking → Disabled
