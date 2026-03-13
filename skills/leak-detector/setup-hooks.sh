#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

git config core.hooksPath "$SCRIPT_DIR/.githooks"
chmod +x "$SCRIPT_DIR/.githooks/pre-commit"

echo "Pre-commit hook installed. Git hooks path set to $SCRIPT_DIR/.githooks"
