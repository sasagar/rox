#!/bin/bash
#
# Rox Production Start Script
#
# This wrapper script uses exec -a to set the process name visible in top/ps.
# Usage: ./scripts/start.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Find bun executable
if command -v bun &> /dev/null; then
    BUN_PATH="$(command -v bun)"
elif [ -x "$HOME/.bun/bin/bun" ]; then
    BUN_PATH="$HOME/.bun/bin/bun"
elif [ -x "/root/.bun/bin/bun" ]; then
    BUN_PATH="/root/.bun/bin/bun"
else
    echo "Error: bun not found" >&2
    exit 1
fi

# exec -a sets the process name (argv[0]) shown in top/ps
exec -a "rox" "$BUN_PATH" scripts/start-production.ts "$@"
