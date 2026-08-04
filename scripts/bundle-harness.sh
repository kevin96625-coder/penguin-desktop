#!/usr/bin/env bash
# Flatten the harness into a self-contained tree the .app can ship.
#
# `pnpm deploy` is what the official release uses: it resolves the CLI package's
# production dependency graph and writes a flat node_modules, so the bundled tree runs
# without the pnpm workspace links that dist/ alone depends on.
#
# The output lives OUTSIDE the submodule (penguin-desktop/dist-harness) so the
# "never modify vendor/" guardrail still holds, and it is gitignored.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist-harness"

rm -rf "$OUT"
cd "$ROOT/vendor/penguin-harness"
pnpm --filter @prismshadow/penguin-cli --prod deploy "$OUT" --config.node-linker=hoisted

test -f "$OUT/dist/index.js" || { echo "bundle-harness: missing $OUT/dist/index.js" >&2; exit 1; }
echo "bundle-harness: ok -> $OUT"
