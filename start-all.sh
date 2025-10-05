#!/bin/bash

# ================================================================
# Traffic Management System Launcher (MongoDB + Backend + Frontend)
# Opens each process in a separate terminal window
# Works for macOS (Terminal.app) and Linux (GNOME Terminal)
# ================================================================

# Detect OS
OS="$(uname)"
cd "$(dirname "$0")" || exit 1

# -------------------------------
# Function to open a new terminal
# -------------------------------
open_terminal() {
    local CMD="$1"
    if [[ "$OS" == "Darwin" ]]; then
        # macOS Terminal
        osascript <<EOF
tell application "Terminal"
    do script "$CMD; exec bash"
end tell
EOF
    else
        # Linux GNOME Terminal
        gnome-terminal -- bash -c "$CMD; exec bash"
    fi
}

# ==============================
# 1️⃣ Start MongoDB
# ==============================
echo "[1/3] Checking/starting MongoDB..."

if [[ "$OS" == "Darwin" ]]; then
    MONGO_CMD="if brew services list | grep -q 'mongodb.*started'; then echo 'MongoDB service already running'; else brew services start mongodb/brew/mongodb-community; sleep 3; fi"
else
    MONGO_CMD="if pgrep -x mongod >/dev/null; then echo 'MongoDB already running'; else mkdir -p \$HOME/mongodb-data \$HOME/mongodb-logs; mongod --dbpath \$HOME/mongodb-data --logpath \$HOME/mongodb-logs/mongod.log --bind_ip 127.0.0.1 --port 27017 & sleep 3; fi"
fi

open_terminal "$MONGO_CMD"
sleep 2

# ==============================
# 2️⃣ Start Backend
# ==============================
echo "[2/3] Launching Backend..."
BACKEND_CMD="cd '$(pwd)/backend'; if [ ! -d 'node_modules' ]; then echo 'Installing backend dependencies...'; npm install; fi; echo 'Starting backend...'; npm run dev"
open_terminal "$BACKEND_CMD"
sleep 2

# ==============================
# 3️⃣ Start Frontend
# ==============================
echo "[3/3] Launching Frontend..."
FRONTEND_CMD="cd '$(pwd)/frontend'; if [ ! -d 'node_modules' ]; then echo 'Installing frontend dependencies...'; npm install; fi; echo 'Starting frontend...'; npm start"
open_terminal "$FRONTEND_CMD"
sleep 1

# ==============================
# Summary
# ==============================
echo
echo "------------------------------------------------------------"
echo "Launch commands sent. Each process should open in a new terminal."
echo "- MongoDB:     running on mongodb://localhost:27017"
echo "- Backend:     http://localhost:5000/"
echo "- Frontend:    http://localhost:3000/"
echo "------------------------------------------------------------"