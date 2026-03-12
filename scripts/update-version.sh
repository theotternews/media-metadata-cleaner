#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: scripts/update-version.sh <new-version>" >&2
  exit 1
fi

NEW_VERSION="$1"

if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Version \"$NEW_VERSION\" does not look like x.y.z; aborting." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PKG_JSON="$REPO_ROOT/package.json"

if [[ ! -f "$PKG_JSON" ]]; then
  echo "Could not find package.json; run this script from within the repo." >&2
  exit 1
fi

# Extract current version from package.json (first "version" field)
CURRENT_VERSION="$(grep -m1 '"version"' "$PKG_JSON" | sed -E 's/.*"version": *"([^"]+)".*/\1/')"

if [[ -z "$CURRENT_VERSION" ]]; then
  echo "package.json has no detectable \"version\" field." >&2
  exit 1
fi

if [[ "$CURRENT_VERSION" == "$NEW_VERSION" ]]; then
  echo "Version is already $NEW_VERSION; nothing to do."
  exit 0
fi

echo "Updating version from $CURRENT_VERSION -> $NEW_VERSION"

###############################################################################
# package.json
###############################################################################
echo "Updating package.json"
sed -i -E \
  "0,/\"version\": *\"$CURRENT_VERSION\"/s//\"version\": \"$NEW_VERSION\"/" \
  "$PKG_JSON"

###############################################################################
# package-lock.json (if present)
###############################################################################
LOCK_JSON="$REPO_ROOT/package-lock.json"
if [[ -f "$LOCK_JSON" ]]; then
  echo "Updating package-lock.json"
  # Top-level "version"
  sed -i -E \
    "0,/\"version\": *\"$CURRENT_VERSION\"/s//\"version\": \"$NEW_VERSION\"/" \
    "$LOCK_JSON"

  # npm v7+ packages[""].version
  sed -i -E \
    "0,/\"packages\" *: *\{/s//\"packages\": {/" \
    "$LOCK_JSON" >/dev/null 2>&1 || true

  sed -i -E \
    "0,/\"\" *: *\{/s//\"\": {/" \
    "$LOCK_JSON" >/dev/null 2>&1 || true

  sed -i -E \
    "0,/\"\" *: *\{[^}]*\"version\": *\"$CURRENT_VERSION\"/s//\"\": {\"version\": \"$NEW_VERSION\"/" \
    "$LOCK_JSON" >/dev/null 2>&1 || true
fi

###############################################################################
# src-tauri/tauri.conf.json
###############################################################################
TAURI_CONF="$REPO_ROOT/src-tauri/tauri.conf.json"
if [[ -f "$TAURI_CONF" ]]; then
  echo "Updating src-tauri/tauri.conf.json"
  sed -i -E \
    "0,/\"version\": *\"$CURRENT_VERSION\"/s//\"version\": \"$NEW_VERSION\"/" \
    "$TAURI_CONF"
fi

###############################################################################
# src-tauri/Cargo.toml
###############################################################################
CARGO_TOML="$REPO_ROOT/src-tauri/Cargo.toml"
if [[ -f "$CARGO_TOML" ]]; then
  echo "Updating src-tauri/Cargo.toml"
  sed -i -E \
    "0,/^version *= *\"$CURRENT_VERSION\"/s//version = \"$NEW_VERSION\"/" \
    "$CARGO_TOML"
fi

###############################################################################
# docs/index.html download URLs
###############################################################################
DOCS_INDEX="$REPO_ROOT/docs/index.html"
if [[ -f "$DOCS_INDEX" ]]; then
  echo "Updating docs/index.html download links"

  # Windows MSI
  sed -i -E \
    "s/media-metadata-cleaner-${CURRENT_VERSION}_x64_en-US\.msi/media-metadata-cleaner-${NEW_VERSION}_x64_en-US.msi/g" \
    "$DOCS_INDEX"

  # macOS DMG
  sed -i -E \
    "s/media-metadata-cleaner-${CURRENT_VERSION}_x64_en-US\.dmg/media-metadata-cleaner-${NEW_VERSION}_x64_en-US.dmg/g" \
    "$DOCS_INDEX"

  # Linux .deb (Ubuntu/Debian)
  sed -i -E \
    "s/media-metadata-cleaner-${CURRENT_VERSION}_amd64\.deb/media-metadata-cleaner-${NEW_VERSION}_amd64.deb/g" \
    "$DOCS_INDEX"

  # Linux .rpm: linux-<version>-1.x86_64.rpm
  sed -i -E \
    "s/media-metadata-cleaner-${CURRENT_VERSION}-1\.x86_64\.rpm/media-metadata-cleaner-${NEW_VERSION}-1.x86_64.rpm/g" \
    "$DOCS_INDEX"

  # Linux .AppImage: linux-<version>-1.x86_64.AppImage
  sed -i -E \
    "s/media-metadata-cleaner-${CURRENT_VERSION}-1\.x86_64\.AppImage/media-metadata-cleaner-${NEW_VERSION}-1.x86_64.AppImage/g" \
    "$DOCS_INDEX"
fi

echo "Done."
echo "Note: you may want to regenerate lockfiles (Cargo.lock, package-lock.json) with your usual build tools."

