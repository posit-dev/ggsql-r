#!/usr/bin/env sh
set -eu

# Determine repository root relative to this script without external dirname.
SCRIPT_PATH=${0:-}
case "$SCRIPT_PATH" in
  */*) SCRIPT_DIR=${SCRIPT_PATH%/*} ;;
  *) SCRIPT_DIR=. ;;
esac
SCRIPT_DIR=$(cd "$SCRIPT_DIR" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

if ! command -v node >/dev/null 2>&1; then
  printf 'Node is not installed in PATH; skipping JS verification.\n'
  exit 0
fi

if ! command -v npm >/dev/null 2>&1; then
  printf 'npm is not installed in PATH; skipping JS verification.\n'
  exit 0
fi

cd "$REPO_ROOT"
npm run check
