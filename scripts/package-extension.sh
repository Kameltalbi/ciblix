#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/extension"

echo "Building extension for Chrome Web Store…"
NODE_ENV=production npm run build

cd dist
OUT="$ROOT/extension/ciblix-extension.zip"
rm -f "$OUT"
zip -r "$OUT" . -x "*.DS_Store"
echo "Created $OUT"
