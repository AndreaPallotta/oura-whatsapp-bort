#!/bin/bash
set -e

# Get project root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Oura WhatsApp Bot Setup ==="

# 1. Check for .env file
if [ ! -f .env ]; then
  echo "Configuration file (.env) not found."
  echo "Copying .env.example to .env..."
  cp .env.example .env
  echo "Please edit the .env file in the root folder and fill in your Oura credentials."
  echo "After editing .env, run this setup script again."
  exit 0
fi

# 2. Install dependencies if node_modules is missing
if [ ! -d node_modules ]; then
  echo "Installing Node.js dependencies..."
  npm install
else
  echo "Dependencies already installed."
fi

# 3. Run Oura authorization setup
echo "Starting Oura Ring Authorization..."
npm run auth
