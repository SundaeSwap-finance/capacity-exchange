#!/usr/bin/env bash
set -e

# Load env vars
source "$(dirname "$0")/env.sh"

echo "Provisioning test wallet..."
./scripts/gen-test-wallet.sh

echo "Building project"
npm run build

echo "Running E2E tests"
npm run test:e2e
echo "Complete"
