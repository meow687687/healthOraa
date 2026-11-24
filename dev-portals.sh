#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PORTAL_PIDS=()

stop_portals() {
  local pid

  for pid in "${PORTAL_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done

  for pid in "${PORTAL_PIDS[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}

trap stop_portals EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start_portal() {
  local portal="$1"
  local port="$2"
  local vite="$ROOT_DIR/apps/$portal/node_modules/.bin/vite"

  if [[ ! -x "$vite" ]]; then
    printf 'Missing Vite executable for %s. Install workspace dependencies first.\n' "$portal" >&2
    exit 1
  fi

  printf '%s portal: http://localhost:%s\n' "$portal" "$port"
  (
    cd "$ROOT_DIR/apps/$portal"
    exec ./node_modules/.bin/vite --host 127.0.0.1 --port "$port" --strictPort
  ) &
  PORTAL_PIDS+=("$!")
}

start_portal admin-portal 5173
start_portal doctor-portal 5174
start_portal patient-portal 5175

# Stop the other servers if any portal exits.
if wait -n "${PORTAL_PIDS[@]}"; then
  exit 0
else
  exit "$?"
fi
