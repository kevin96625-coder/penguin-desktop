#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../vendor/penguin-harness"
pnpm install
pnpm -r build
