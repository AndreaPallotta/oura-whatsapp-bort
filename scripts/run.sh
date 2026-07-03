#!/bin/bash
set -e

# Get project root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env ] || [ ! -d node_modules ] || [ ! -f state.json ]; then
  echo "Error: Bot is not configured yet."
  echo "Please make sure you have created your .env file and completed the setup: ./scripts/setup.sh"
  exit 1
fi

# Pass all script arguments directly to the main script
npm start -- "$@"
