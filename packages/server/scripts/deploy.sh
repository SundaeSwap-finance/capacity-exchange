#!/usr/bin/env bash
set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/deploy.sh <tokenColor>"
  exit 1
fi

bun src/tools/deploy-cli.ts "$1"
