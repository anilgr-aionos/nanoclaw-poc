#!/bin/bash
# start-nanoclaw.sh — Start NanoClaw without systemd
# To stop: kill \$(cat /home/gr_anil/nanoclaw-poc/nanoclaw/nanoclaw.pid)

set -euo pipefail

cd "/home/gr_anil/nanoclaw-poc/nanoclaw"

# Stop existing instance if running
if [ -f "/home/gr_anil/nanoclaw-poc/nanoclaw/nanoclaw.pid" ]; then
  OLD_PID=$(cat "/home/gr_anil/nanoclaw-poc/nanoclaw/nanoclaw.pid" 2>/dev/null || echo "")
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping existing NanoClaw (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 2
  fi
fi

echo "Starting NanoClaw..."
nohup "/home/gr_anil/.nvm/versions/node/v21.7.3/bin/node" "/home/gr_anil/nanoclaw-poc/nanoclaw/dist/index.js" \
  >> "/home/gr_anil/nanoclaw-poc/nanoclaw/logs/nanoclaw.log" \
  2>> "/home/gr_anil/nanoclaw-poc/nanoclaw/logs/nanoclaw.error.log" &

echo $! > "/home/gr_anil/nanoclaw-poc/nanoclaw/nanoclaw.pid"
echo "NanoClaw started (PID $!)"
echo "Logs: tail -f /home/gr_anil/nanoclaw-poc/nanoclaw/logs/nanoclaw.log"
