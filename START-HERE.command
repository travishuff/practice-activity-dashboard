#!/bin/zsh

set -euo pipefail

PROJECT_DIR="${0:A:h}"
DASHBOARD_URL="http://localhost:3000"

cd "$PROJECT_DIR"
clear

echo "Practice Activity Dashboard setup"
echo "================================="
echo

if [[ ! -f package.json ]]; then
  echo "Keep START-HERE.command inside the downloaded practice-dashboard folder."
  echo "Then double-click it again."
  echo
  read -r "?Press Return to close."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.13 or newer is required."
  echo "Your browser will open the Node.js download page. Install Node.js, then run this file again."
  open "https://nodejs.org/"
  echo
  read -r "?Press Return to close."
  exit 1
fi

node_version="$(node -p 'process.versions.node')"
node_major="${node_version%%.*}"
node_remainder="${node_version#*.}"
node_minor="${node_remainder%%.*}"
if (( node_major < 22 || (node_major == 22 && node_minor < 13) )); then
  echo "Node.js ${node_version} is installed, but version 22.13 or newer is required."
  echo "Your browser will open the Node.js download page. Update Node.js, then run this file again."
  open "https://nodejs.org/"
  echo
  read -r "?Press Return to close."
  exit 1
fi

echo "Before continuing, make your Practice Log readable by the dashboard:"
echo
echo "  1. Open the Practice Log in Google Sheets."
echo "  2. Click Share."
echo "  3. Under General access, choose Anyone with the link."
echo "  4. Keep the role set to Viewer. This makes the shared access read-only."
echo "  5. Click Copy link."
echo
echo "Anyone who has that link can view the sheet, including the practiced items in column C."
echo
read -r "?When the sheet is shared as Viewer, press Return to continue."

while true; do
  echo
  read -r "sheet_url?Paste the full Google Sheets URL: "
  if [[ "$sheet_url" == https://docs.google.com/spreadsheets/d/* ]]; then
    break
  fi
  echo "That does not look like a Google Sheets URL. It should begin with:"
  echo "https://docs.google.com/spreadsheets/d/"
done

printf 'GOOGLE_SHEET_URL="%s"\n' "$sheet_url" > .env.local

echo
echo "Installing the dashboard..."
npx --yes pnpm@10 install

echo
echo "Starting the dashboard at ${DASHBOARD_URL}..."
npx --yes pnpm@10 dev &
server_pid=$!

stop_server() {
  kill "$server_pid" >/dev/null 2>&1 || true
}
trap stop_server INT TERM EXIT

for attempt in {1..60}; do
  if curl --silent --fail "$DASHBOARD_URL" >/dev/null 2>&1; then
    open "$DASHBOARD_URL"
    echo
    echo "The dashboard is open in your browser."
    echo "Keep this Terminal window open while you use it."
    echo "Press Control-C here when you want to stop the local server."
    wait "$server_pid"
    exit $?
  fi
  sleep 1
done

echo
echo "The local server did not become ready within one minute."
echo "Review the messages above for the cause, then run START-HERE.command again."
wait "$server_pid"
