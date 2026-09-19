#!/bin/bash
# Double-click on a MacBook to build the macOS app (.dmg + .zip, Intel + Apple Silicon).
# Requires Node.js LTS from https://nodejs.org
cd "$(dirname "$0")" || exit 1
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."
  read -r -p "Press Enter to close..."; exit 1
fi
rm -rf node_modules
npm install --no-fund --no-audit || { read -r -p "npm install failed. Press Enter..."; exit 1; }
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac || { read -r -p "Build failed. Press Enter..."; exit 1; }
open dist
echo "Done. Open the .dmg in the dist folder and drag the app to Applications."
read -r -p "Press Enter to close..."
