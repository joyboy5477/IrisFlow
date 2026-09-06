#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/native/MacKeyServer.swift"
OUT_DIR="$ROOT/bin"
OUT="$OUT_DIR/MacKeyServer"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "MacKeyServer can only be built on macOS." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
swiftc \
  -O \
  -target arm64-apple-macos11.0 \
  -framework ApplicationServices \
  "$SRC" \
  -o "$OUT"
chmod +x "$OUT"
file "$OUT"
