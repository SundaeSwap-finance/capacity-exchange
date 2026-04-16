#!/usr/bin/env bash
set -e

# Load env vars
source "$(dirname "$0")/env.sh"

echo "Provisioning test wallet..."
./scripts/gen-test-wallet.sh

echo "Building project"
bun run build

echo "Running E2E tests"
bun run test:integ
echo "Complete"
