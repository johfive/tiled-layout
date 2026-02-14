#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="TLPQuickLook"
BUILD_DIR="$SCRIPT_DIR/build"

# Find the Tiled Layout Electron app
ELECTRON_APP="/Applications/Tiled Layout.app"
if [ ! -d "$ELECTRON_APP" ]; then
    ELECTRON_APP="$HOME/Applications/Tiled Layout.app"
fi
if [ ! -d "$ELECTRON_APP" ]; then
    # Check the release directory from electron-builder
    ELECTRON_APP="$SCRIPT_DIR/../release/mac-arm64/Tiled Layout.app"
fi
if [ ! -d "$ELECTRON_APP" ]; then
    echo "Error: Tiled Layout.app not found in /Applications, ~/Applications, or release/"
    exit 1
fi

echo "=== TLP QuickLook Extension Builder ==="
echo "  Target app: $ELECTRON_APP"

# Check for xcodegen
if ! command -v xcodegen &> /dev/null; then
    echo "Error: xcodegen not found. Install with: brew install xcodegen"
    exit 1
fi

# Step 1: Generate Xcode project
echo ""
echo "Step 1: Generating Xcode project..."
xcodegen generate
echo "  Done."

# Step 2: Resolve SPM dependencies
echo ""
echo "Step 2: Resolving Swift Package Manager dependencies..."
xcodebuild -resolvePackageDependencies -project "$APP_NAME.xcodeproj" 2>&1 | tail -3
echo "  Done."

# Step 3: Build each extension target individually
echo ""
echo "Step 3: Building extensions..."

echo "  Building TLPThumbnail..."
xcodebuild \
    -project "$APP_NAME.xcodeproj" \
    -target "TLPThumbnail" \
    -configuration Release \
    SYMROOT="$BUILD_DIR/Build/Products" \
    OBJROOT="$BUILD_DIR/Build/Intermediates" \
    CODE_SIGN_IDENTITY="-" \
    CODE_SIGNING_ALLOWED=YES \
    2>&1 | tail -3

echo "  Building TLPPreview..."
xcodebuild \
    -project "$APP_NAME.xcodeproj" \
    -target "TLPPreview" \
    -configuration Release \
    SYMROOT="$BUILD_DIR/Build/Products" \
    OBJROOT="$BUILD_DIR/Build/Intermediates" \
    CODE_SIGN_IDENTITY="-" \
    CODE_SIGNING_ALLOWED=YES \
    2>&1 | tail -3

# Check that extensions were built
THUMB_APPEX="$BUILD_DIR/Build/Products/Release/TLPThumbnail.appex"
PREVIEW_APPEX="$BUILD_DIR/Build/Products/Release/TLPPreview.appex"

if [ ! -d "$THUMB_APPEX" ] || [ ! -d "$PREVIEW_APPEX" ]; then
    echo "Error: Build failed — extension .appex not found"
    echo "  Expected: $THUMB_APPEX"
    echo "  Expected: $PREVIEW_APPEX"
    echo ""
    echo "Run xcodebuild manually for full output:"
    echo "  cd $SCRIPT_DIR && xcodebuild -project $APP_NAME.xcodeproj -target TLPThumbnail -configuration Release -derivedDataPath build CODE_SIGN_IDENTITY='-'"
    exit 1
fi

echo "  Build succeeded."

# Step 4: Install extensions into the Electron app
echo ""
echo "Step 4: Installing extensions into Tiled Layout.app..."
PLUGINS_DIR="$ELECTRON_APP/Contents/PlugIns"
mkdir -p "$PLUGINS_DIR"

# Remove old extensions if present
rm -rf "$PLUGINS_DIR/TLPThumbnail.appex" 2>/dev/null || true
rm -rf "$PLUGINS_DIR/TLPPreview.appex" 2>/dev/null || true

# Copy extensions from the build
cp -R "$THUMB_APPEX" "$PLUGINS_DIR/"
cp -R "$PREVIEW_APPEX" "$PLUGINS_DIR/"
echo "  Installed TLPThumbnail.appex and TLPPreview.appex"

# Step 5: Add UTExportedTypeDeclarations to the Electron app's Info.plist if not present
echo ""
echo "Step 5: Updating Info.plist with UTType declarations..."
PLIST="$ELECTRON_APP/Contents/Info.plist"

# Check if UTExportedTypeDeclarations already exists
if ! /usr/libexec/PlistBuddy -c "Print :UTExportedTypeDeclarations" "$PLIST" &>/dev/null; then
    /usr/libexec/PlistBuddy -c "Add :UTExportedTypeDeclarations array" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :UTExportedTypeDeclarations:0 dict" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :UTExportedTypeDeclarations:0:UTTypeIdentifier string com.tiledlayout.tlp" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :UTExportedTypeDeclarations:0:UTTypeDescription string 'Tiled Layout Package'" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :UTExportedTypeDeclarations:0:UTTypeConformsTo array" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :UTExportedTypeDeclarations:0:UTTypeConformsTo:0 string com.pkware.zip-archive" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :UTExportedTypeDeclarations:0:UTTypeConformsTo:1 string public.data" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :UTExportedTypeDeclarations:0:UTTypeTagSpecification dict" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :UTExportedTypeDeclarations:0:UTTypeTagSpecification:public.filename-extension array" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :UTExportedTypeDeclarations:0:UTTypeTagSpecification:public.filename-extension:0 string tlp" "$PLIST"
    echo "  Added UTExportedTypeDeclarations."
else
    echo "  UTExportedTypeDeclarations already present."
fi

# Also update CFBundleDocumentTypes to use LSItemContentTypes
if ! /usr/libexec/PlistBuddy -c "Print :CFBundleDocumentTypes:0:LSItemContentTypes" "$PLIST" &>/dev/null; then
    /usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:LSItemContentTypes array" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :CFBundleDocumentTypes:0:LSItemContentTypes:0 string com.tiledlayout.tlp" "$PLIST"
    echo "  Added LSItemContentTypes to CFBundleDocumentTypes."
fi

# Step 6: Re-sign the extensions (preserving entitlements) and the Electron app
echo ""
echo "Step 6: Re-signing..."

# Sign extensions with their entitlements
THUMB_ENT="$SCRIPT_DIR/TLPThumbnail/TLPThumbnail.entitlements"
PREVIEW_ENT="$SCRIPT_DIR/TLPPreview/TLPPreview.entitlements"
codesign --force --sign - --entitlements "$THUMB_ENT" "$PLUGINS_DIR/TLPThumbnail.appex" 2>&1
codesign --force --sign - --entitlements "$PREVIEW_ENT" "$PLUGINS_DIR/TLPPreview.appex" 2>&1

# Re-sign the main app (required since we modified its contents)
codesign --force --sign - "$ELECTRON_APP" 2>&1 || true
echo "  Done."

# Step 7: Register with LaunchServices and reset QuickLook
echo ""
echo "Step 7: Registering and resetting caches..."
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "$ELECTRON_APP"
qlmanage -r 2>/dev/null || true
qlmanage -r cache 2>/dev/null || true

# Launch the app briefly to trigger extension discovery
open "$ELECTRON_APP"
sleep 3
echo "  Done."

# Step 8: Verify registration
echo ""
echo "Step 8: Verifying extension registration..."

THUMB_FOUND=$(pluginkit -m -p com.apple.quicklook.thumbnail 2>&1 | grep -i "tiledlayout" || true)
PREVIEW_FOUND=$(pluginkit -m -p com.apple.quicklook.preview 2>&1 | grep -i "tiledlayout" || true)

if [ -n "$THUMB_FOUND" ]; then
    echo "  Thumbnail extension: REGISTERED"
else
    echo "  Thumbnail extension: NOT YET REGISTERED (may need reboot)"
fi

if [ -n "$PREVIEW_FOUND" ]; then
    echo "  Preview extension: REGISTERED"
else
    echo "  Preview extension: NOT YET REGISTERED (may need reboot)"
fi

echo ""
echo "=== Installation complete ==="
echo ""
echo "To test:"
echo "  1. Select a .tlp file in Finder"
echo "  2. Press Space to preview"
echo "  3. Or run: qlmanage -p /path/to/file.tlp"
echo "  4. Thumbnail test: qlmanage -t /path/to/file.tlp -s 512 -o /tmp/"
