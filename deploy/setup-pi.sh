#!/bin/bash
# setup-pi.sh — One-time setup script for Odysseus Family Planner on Raspberry Pi.
#
# Run this from the project root on the Pi:
#   chmod +x deploy/setup-pi.sh
#   ./deploy/setup-pi.sh
#
# Tested on Raspberry Pi OS (Bookworm/Bullseye), Pi 3 and Pi 4.

set -e

# ---------------------------------------------------------------------------
# Configuration — change INSTALL_DIR if you cloned to a different location.
# ---------------------------------------------------------------------------
INSTALL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_NAME="odysseus"

echo ""
echo "=== Odysseus Family Planner — Raspberry Pi Setup ==="
echo "Install directory: $INSTALL_DIR"
echo ""

# ---------------------------------------------------------------------------
# 1. System dependencies
# ---------------------------------------------------------------------------
echo "[1/8] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y python3 python3-pip python3-venv nodejs npm nginx avahi-daemon

# ---------------------------------------------------------------------------
# 2. Enable avahi-daemon for mDNS (.local hostname resolution)
# ---------------------------------------------------------------------------
echo "[2/8] Enabling avahi-daemon (mDNS)..."
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon

# ---------------------------------------------------------------------------
# 3. Set hostname to 'skylight' so the app is reachable at http://odysseus.local
# ---------------------------------------------------------------------------
echo "[3/8] Setting hostname..."
CURRENT_HOSTNAME=$(hostname)
if [ "$CURRENT_HOSTNAME" != "skylight" ]; then
    echo "  Current hostname: $CURRENT_HOSTNAME"
    echo "  Changing hostname to 'skylight' so the app will be at http://odysseus.local"
    echo "  (A reboot is recommended after setup for this to fully take effect.)"
    sudo hostnamectl set-hostname odysseus
    # Update /etc/hosts so the new hostname resolves locally
    if grep -q "127.0.1.1" /etc/hosts; then
        sudo sed -i "s/^127\.0\.1\.1.*/127.0.1.1\tskylight/" /etc/hosts
    else
        echo "127.0.1.1	skylight" | sudo tee -a /etc/hosts > /dev/null
    fi
else
    echo "  Hostname is already 'skylight', skipping."
fi

# ---------------------------------------------------------------------------
# 4. Python virtual environment + dependencies
# ---------------------------------------------------------------------------
echo "[4/8] Setting up Python virtual environment..."
cd "$INSTALL_DIR/backend"
python3 -m venv ../venv
../venv/bin/pip install --upgrade pip --quiet
../venv/bin/pip install -r requirements.txt --quiet
echo "  Python dependencies installed."

# ---------------------------------------------------------------------------
# 5. Build the frontend
# ---------------------------------------------------------------------------
echo "[5/8] Building frontend (this may take a minute)..."
cd "$INSTALL_DIR/frontend"
npm install --silent
npm run build
echo "  Frontend built to frontend/dist/"

# ---------------------------------------------------------------------------
# 6. Create .env from .env.example if one does not already exist
# ---------------------------------------------------------------------------
echo "[6/8] Checking environment configuration..."
ENV_FILE="$INSTALL_DIR/backend/.env"
ENV_EXAMPLE="$INSTALL_DIR/backend/.env.example"

if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo ""
        echo "  Created backend/.env from .env.example"
        echo "  *** ACTION REQUIRED: Edit backend/.env and fill in your values: ***"
        echo "      GOOGLE_CLIENT_ID      — from Google Cloud Console (optional)"
        echo "      GOOGLE_CLIENT_SECRET  — from Google Cloud Console (optional)"
        echo "      SECRET_KEY            — any long random string"
        echo ""
    else
        echo "  WARNING: No .env.example found. Create backend/.env manually."
    fi
else
    echo "  backend/.env already exists, leaving it unchanged."
fi

# ---------------------------------------------------------------------------
# 7. Install and enable the systemd service
# ---------------------------------------------------------------------------
echo "[7/8] Installing systemd service..."
# Copy the unit file and substitute the install path in case it differs from
# the default /home/pi/skylight.
sudo cp "$INSTALL_DIR/deploy/odysseus.service" /etc/systemd/system/odysseus.service
sudo sed -i "s|/home/pi/skylight|$INSTALL_DIR|g" /etc/systemd/system/odysseus.service
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl start "$SERVICE_NAME"
echo "  Service enabled and started."

# ---------------------------------------------------------------------------
# 8. Configure nginx as a reverse proxy on port 80
# ---------------------------------------------------------------------------
echo "[8/8] Configuring nginx..."
sudo cp "$INSTALL_DIR/deploy/nginx.conf" /etc/nginx/sites-available/odysseus
sudo ln -sf /etc/nginx/sites-available/odysseus /etc/nginx/sites-enabled/odysseus
# Remove the default nginx placeholder site so it doesn't interfere
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
echo "  nginx configured and restarted."

# ---------------------------------------------------------------------------
# Done!
# ---------------------------------------------------------------------------
PI_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "================================================================"
echo "  Setup complete!"
echo "================================================================"
echo ""
echo "  Odysseus is running at:"
echo "    http://odysseus.local       (once mDNS propagates)"
echo "    http://$PI_IP              (direct IP, works immediately)"
echo ""
echo "  If http://odysseus.local doesn't resolve straight away, try"
echo "  rebooting the Pi: sudo reboot"
echo ""
echo "  Useful commands:"
echo "    sudo systemctl status $SERVICE_NAME          # service status"
echo "    sudo journalctl -u $SERVICE_NAME -f          # live logs"
echo "    cd $INSTALL_DIR && ./deploy/update.sh        # update app"
echo ""
echo "  Next step — add your Google Calendar credentials:"
echo "    nano $INSTALL_DIR/backend/.env"
echo "  (See README.md for full Google Calendar setup instructions.)"
echo ""
