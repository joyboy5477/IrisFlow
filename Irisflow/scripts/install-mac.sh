#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Iris Flow can only be installed on macOS." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="/Applications/Irisflow.app"

APP=""
for candidate in \
  "$ROOT/release/mac-arm64/Irisflow.app" \
  "$ROOT/release/mac/Irisflow.app"; do
  if [[ -d "$candidate" ]]; then
    APP="$candidate"
    break
  fi
done

if [[ -z "$APP" ]]; then
  echo "Irisflow.app was not found under release/. Run npm run dist:mac first." >&2
  exit 1
fi

echo "Installing Irisflow → $DEST"
osascript -e 'tell application "Irisflow" to quit' >/dev/null 2>&1 || true
sleep 1
rm -rf "/Applications/Iris Flow.app" "$DEST"
cp -R "$APP" "$DEST"
xattr -cr "$DEST" 2>/dev/null || true
rm -rf "$ROOT/release"

echo "Signed as:"
codesign -d -v "$DEST" 2>&1 | egrep 'Identifier|Authority|Signature' || true
echo "Requirement:"
codesign -d -r- "$DEST" 2>&1 | sed 's/^/# /'

echo
echo "Irisflow is in Applications. You can open it from Spotlight or the Dock anytime."
echo "The project copy in release/ was removed so the app lives in one place."
echo "You do not need Terminal or npm start after this."
echo
echo "First launch (unsigned build): Finder → Applications → right-click Irisflow → Open → Open."
echo "Then grant Accessibility and Microphone to Irisflow (not Terminal), and paste your API keys."
