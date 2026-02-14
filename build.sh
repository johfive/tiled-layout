#!/bin/bash
set -e

# === Configuration ===
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE="/opt/homebrew/bin/node"
APP_NAME="Tiled Layout"
BUILD_NUMBER_FILE="$PROJECT_DIR/BUILD_NUMBER"
BUILD_INFO_TS="$PROJECT_DIR/src/buildInfo.ts"
BUILD_INFO_JSON="$PROJECT_DIR/public/build-info.json"
RELEASE_APP="$PROJECT_DIR/release/mac-arm64/$APP_NAME.app"
INSTALL_APP="/Applications/$APP_NAME.app"

# === Increment build number ===
if [ -f "$BUILD_NUMBER_FILE" ]; then
  BUILD=$(cat "$BUILD_NUMBER_FILE" | tr -d '[:space:]')
else
  BUILD=0
fi
BUILD=$((BUILD + 1))
echo "$BUILD" > "$BUILD_NUMBER_FILE"

echo "=== Build #$BUILD ==="

# === Generate build info files ===
echo "export const BUILD_NUMBER = $BUILD" > "$BUILD_INFO_TS"
echo "{\"build\": $BUILD}" > "$BUILD_INFO_JSON"

# === Close existing app ===
echo "Closing $APP_NAME..."
osascript -e "tell application \"$APP_NAME\" to quit" 2>/dev/null || true
sleep 1

# === Build ===
echo "Running tsc..."
$NODE "$PROJECT_DIR/node_modules/.bin/tsc" --noEmit

echo "Running vite build..."
$NODE "$PROJECT_DIR/node_modules/.bin/vite" build

echo "Running electron-builder..."
$NODE "$PROJECT_DIR/node_modules/.bin/electron-builder" --mac --arm64

# === Copy to /Applications ===
echo "Installing to /Applications..."
rm -rf "$INSTALL_APP"
cp -R "$RELEASE_APP" "$INSTALL_APP"

# === Verify build number in installed app ===
INSTALLED_BUILD_INFO="$INSTALL_APP/Contents/Resources/app.asar.unpacked/../../../Contents/Resources/app/dist/build-info.json"
# The build-info.json is inside the asar, so read from the release copy instead
RELEASE_BUILD_INFO="$PROJECT_DIR/release/mac-arm64/$APP_NAME.app/Contents/Resources/app.asar.unpacked/../dist/build-info.json"

# Try reading from the release dist folder directly
DIST_BUILD_INFO="$PROJECT_DIR/dist/build-info.json"
if [ -f "$DIST_BUILD_INFO" ]; then
  INSTALLED_BUILD=$(cat "$DIST_BUILD_INFO" | tr -d '{}[:space:]' | sed 's/.*"build"://' | sed 's/"//g')
  if [ "$INSTALLED_BUILD" = "$BUILD" ]; then
    echo "Build verified: #$BUILD"
  else
    echo "WARNING: Build mismatch! Expected $BUILD, got $INSTALLED_BUILD"
    exit 1
  fi
else
  echo "Note: Could not verify build number (build-info.json not found in dist)"
fi

# === Launch ===
echo "Launching $APP_NAME..."
open "$INSTALL_APP"

echo "=== Done! Build #$BUILD ==="
