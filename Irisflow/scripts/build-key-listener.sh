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

IDENTITY="${IRISFLOW_CODESIGN_IDENTITY:-}"
if [[ -z "$IDENTITY" ]]; then
  IDENTITY="$(security find-identity -v -p codesigning 2>/dev/null | awk -F '"' '/Developer ID Application:|Apple Development:|Irisflow/{print $2; exit}')"
fi
if [[ -n "$IDENTITY" ]]; then
  codesign --sign "$IDENTITY" --force --identifier com.irisflow.keys --timestamp=none "$OUT" >/dev/null 2>&1 || true
else
  codesign --sign - --force --identifier com.irisflow.keys "$OUT" >/dev/null 2>&1 || true
fi
file "$OUT"

clang \
  -dynamiclib \
  -O2 \
  -target arm64-apple-macos11.0 \
  -framework ApplicationServices \
  -o "$OUT_DIR/libiriskeys.dylib" \
  "$ROOT/native/iris_keys.c"
if [[ -n "$IDENTITY" ]]; then
  codesign --sign "$IDENTITY" --force --identifier com.irisflow.keys --timestamp=none "$OUT_DIR/libiriskeys.dylib" >/dev/null 2>&1 || true
else
  codesign --sign - --force --identifier com.irisflow.keys "$OUT_DIR/libiriskeys.dylib" >/dev/null 2>&1 || true
fi
file "$OUT_DIR/libiriskeys.dylib"
