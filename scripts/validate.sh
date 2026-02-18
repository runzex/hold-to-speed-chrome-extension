#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

node --check "$ROOT/constants.js"
node --check "$ROOT/content.js"
node --check "$ROOT/popup.js"

if command -v jq >/dev/null 2>&1; then
  jq . "$ROOT/manifest.json" >/dev/null
else
  node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$ROOT/manifest.json"
fi

if rg -n "^(<<<<<<<|=======|>>>>>>>)" "$ROOT" -g '!scripts/validate.sh' >/dev/null; then
  echo "Found unresolved merge markers" >&2
  exit 1
fi

echo "Validation passed"
