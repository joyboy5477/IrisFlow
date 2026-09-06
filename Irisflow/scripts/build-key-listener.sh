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
codesign --sign - --force --identifier com.irisflow.app "$OUT" >/dev/null 2>&1 || true
file "$OUT"

clang \
  -dynamiclib \
  -O2 \
  -target arm64-apple-macos11.0 \
  -framework ApplicationServices \
  -o "$OUT_DIR/libiriskeys.dylib" \
  "$ROOT/native/iris_keys.c"
codesign --sign - --force --identifier com.irisflow.app "$OUT_DIR/libiriskeys.dylib" >/dev/null 2>&1 || true
file "$OUT_DIR/libiriskeys.dylib"
