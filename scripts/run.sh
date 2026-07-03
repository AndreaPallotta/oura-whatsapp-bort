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

# Default command args
CMD_ARGS=""

# Parse bash parameters and map to node parameters
while [[ "$#" -gt 0 ]]; do
  case $1 in
    -t|--test|--test-send)
      CMD_ARGS="$CMD_ARGS --test-send"
      shift
      ;;
    -d|--dry|--dry-run)
      CMD_ARGS="$CMD_ARGS --dry-run"
      shift
      ;;
    -f|--force)
      CMD_ARGS="$CMD_ARGS --force"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./scripts/run.sh [-t|--test] [-d|--dry] [-f|--force]"
      exit 1
      ;;
  esac
done

# Execute main process
node index.js $CMD_ARGS
