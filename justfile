contracts_dir := "packages/example-webapp/contracts"
webapp_dir := "packages/example-webapp"

# Check that COMPACTC is set and valid
_check-compactc:
    @test -n "$COMPACTC" || (echo "Error: COMPACTC environment variable not set. Pre-built binaries available in tools/compactc." && exit 1)
    @test -f "$COMPACTC" || (echo "Error: COMPACTC path does not exist: $COMPACTC" && exit 1)
    @"$COMPACTC" --version | grep -q "0.26.108" || (echo "Error: COMPACTC version mismatch. Required: 0.26.108" && exit 1)

# Check that setup has been run
_check-setup:
    @test -d {{webapp_dir}}/public/midnight/counter/keys || (echo "Error: ZK assets not found. Run 'just setup' first." && exit 1)

# Copy compiled ZK assets to webapp public directory
_copy-zk-assets:
    mkdir -p {{webapp_dir}}/public/midnight/counter/keys {{webapp_dir}}/public/midnight/counter/zkir
    cp -r {{contracts_dir}}/counter/out/keys/* {{webapp_dir}}/public/midnight/counter/keys/
    cp -r {{contracts_dir}}/counter/out/zkir/* {{webapp_dir}}/public/midnight/counter/zkir/

# Compile Compact contracts
compile-contracts: _check-compactc
    npm run compile --prefix {{contracts_dir}}

# One-time setup: compile contracts and copy assets
setup: compile-contracts _copy-zk-assets
    @echo "Setup complete. Run 'just build' or 'just dev' to continue."

# Build all packages
build: _check-setup
    npm run build -ws --if-present

# Run dev server
dev: _check-setup
    npx concurrently --kill-others-on-fail "npm:build:watch --workspace=@capacity-exchange/components" "npm:dev --workspace=@capacity-exchange/example-webapp"

# Run tests
test:
    npm run test -ws --if-present

# Run counter contract e2e test
counter-e2e:
    npm run counter:e2e --prefix {{contracts_dir}}

# Run token-mint contract e2e test
token-mint-e2e:
    npm run token-mint:e2e --prefix {{contracts_dir}}

# Lint and format check
check:
    npx eslint . && npx prettier --check .

# Lint and format fix
fix:
    npx eslint . --fix && npx prettier --write .

# Clean build artifacts
clean:
    npm run clean -ws --if-present
    npm run clean --prefix {{contracts_dir}}
    rm -rf {{webapp_dir}}/public/midnight
