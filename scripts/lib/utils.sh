#!/usr/bin/env bash
# Shared helpers for CES server shell scripts.
# Source this file — do not execute it directly.

# generate_quote_secret <output_file>
# Writes a fresh 32-byte hex secret to <output_file> with umask 077.
generate_quote_secret() {
  local output_file="$1"
  local old_umask
  old_umask="$(umask)"
  umask 077
  openssl rand -hex 32 > "$output_file"
  umask "$old_umask"
}

# generate_runner_wallet <root_dir>
# Prints a fresh ephemeral mnemonic to stdout.
generate_runner_wallet() {
  local root_dir="$1"
  bun -e "import { generateMnemonic } from '$root_dir/packages/midnight-core/src/seed.ts'; console.log(generateMnemonic());"
}

# wait_for_server <port> <label> <pid_var> <retries>
# Polls http://localhost:<port>/health/ready until ready.
# Exits 1 if the process named by <pid_var> dies or <retries> is exceeded.
wait_for_server() {
  local port="$1" label="$2" pid_var="$3" retries="$4"
  echo "=== Waiting for $label (port $port) to be ready"
  for i in $(seq 1 "$retries"); do
    if curl -sf "http://localhost:${port}/health/ready" > /dev/null 2>&1; then
      echo "=== $label is ready"
      return
    fi
    if ! kill -0 "${!pid_var}" 2>/dev/null; then
      echo "=== ERROR: $label exited unexpectedly"
      return 1
    fi
    sleep 2
  done
  echo "=== ERROR: $label did not become ready in time"
  return 1
}
