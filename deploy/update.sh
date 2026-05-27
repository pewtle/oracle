#!/bin/bash
# update.sh — Update Odysseus after copying new files to the Pi.
#
# Run from the project root:
#   ./deploy/update.sh
#
# What it does:
#   1. Re-installs Python dependencies (picks up any new packages)
#   2. Rebuilds the frontend
#   3. Restarts the systemd service

set -e

INSTALL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_NAME="odysseus"

echo ""
echo "=== Updating Odysseus Family Planner ==="
echo "Install directory: $INSTALL_DIR"
echo ""

# ---------------------------------------------------------------------------
# 1. Python dependencies
# ---------------------------------------------------------------------------
echo "[1/3] Updating Python dependencies..."
cd "$INSTALL_DIR/backend"
../venv/bin/pip install -r requirements.txt --quiet
echo "  Done."

# ---------------------------------------------------------------------------
# 2. Rebuild frontend
# ---------------------------------------------------------------------------
echo "[2/3] Rebuilding frontend..."
cd "$INSTALL_DIR/frontend"
npm install --silent
npm run build
echo "  Done."

# ---------------------------------------------------------------------------
# 3. Restart service
# ---------------------------------------------------------------------------
echo "[3/3] Restarting service..."
sudo systemctl restart "$SERVICE_NAME"
echo "  Service restarted."
echo ""

# Show current status so you can confirm it came back up cleanly.
sudo systemctl status "$SERVICE_NAME" --no-pager

echo ""
echo "=== Update complete ==="
echo "  http://odysseus.local"
echo "  http://$(hostname -I | awk '{print $1}')"
echo ""
