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

# generate_price_config_file <output_file> <derived_token_color> <token_mint_address>
# Runs gen-price-config.ts to produce a price config at <output_file>.
# ROOT_DIR must be set by the caller.
generate_price_config_file() {
  local output_file="$1"
  local derived_token_color="$2"
  local token_mint_address="$3"
  bun "$ROOT_DIR/scripts/gen-price-config.ts" "$output_file" "$derived_token_color" "$token_mint_address"
}