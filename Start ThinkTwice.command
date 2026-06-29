#!/bin/bash
# One-click launcher for Think Twice (macOS).
# Double-click in Finder: starts the local Next.js server if it isn't already
# running, then opens the app in your default browser.
# The server keeps running after this window closes (nohup), so debates work.
# To stop it later, run:  pkill -f "next dev"

cd "$(dirname "$0")" || exit 1

# Make sure node / npm are findable when launched from Finder
# (Finder gives apps a minimal PATH).
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

URL="http://localhost:3000"

up() { curl -s -m 2 -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null | grep -q "200"; }

if up; then
  echo "Think Twice is already running."
  open "$URL"
  sleep 1
  exit 0
fi

# Free port 3000 from any stale server, then start ours.
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1

# Install dependencies on first run if needed.
if [ ! -d "node_modules" ]; then
  echo "First run: installing dependencies (this can take a minute)..."
  npm install
fi

echo "Starting the Think Twice server..."
nohup npm run dev > /tmp/think-twice.log 2>&1 &

echo "Waiting for the server to come up..."
for i in $(seq 1 60); do
  up && break
  sleep 0.5
done

if up; then
  echo "Think Twice is up. Opening $URL"
  open "$URL"
else
  echo ""
  echo "Could not start the server. Last log lines:"
  tail -n 20 /tmp/think-twice.log 2>/dev/null
  echo ""
  echo "Make sure Node.js is installed (tried PATH including /opt/homebrew/bin)."
fi
sleep 1
