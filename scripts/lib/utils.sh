#!/usr/bin/env bash
# Shared helpers for CES shell scripts. 
[[ "${BASH_SOURCE[0]}" == "$0" ]] && { echo "Error: Not meant to be executed directly." >&2; exit 1; }

# generate_quote_secret <output_file>
# Writes a fresh 32-byte hex secret to <output_file>.
# umask 077 to make file owner-readable only (mode 600).
generate_quote_secret() {
  local output_file="$1"
  local old_umask
  old_umask="$(umask)"
  umask 077
  openssl rand -hex 32 > "$output_file"
  umask "$old_umask"
}

# write_secret_file <content> <output_file>
# Writes <content> to <output_file> with mode 600 (owner-readable only).
write_secret_file() {
  local content="$1" output_file="$2"
  local old_umask
  old_umask="$(umask)"
  umask 077
  printf '%s\n' "$content" > "$output_file"
  umask "$old_umask"
}

# generate_runner_wallet <root_dir>
# Prints a fresh ephemeral BIP-39 mnemonic to stdout.
generate_runner_wallet() {
  local root_dir="$1"
  bun -e "import { generateMnemonic } from '$root_dir/packages/midnight-core/src/seed.ts'; console.log(generateMnemonic());"
}

# wait_for_server <port> <label> <pid_var> <retries>
# Polls http://localhost:<port>/health/ready every 2 s until the server responds.
# Returns 1 if the process named by <pid_var> exits unexpectedly or <retries> is exceeded.
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
