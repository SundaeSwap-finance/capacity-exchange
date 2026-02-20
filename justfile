contracts_dir := "packages/example-webapp/contracts"
webapp_dir := "packages/example-webapp"

# Compile contracts only if not already compiled
_compile-contracts-if-needed: _check-compactc
    @test -d {{contracts_dir}}/counter/out && test -d {{contracts_dir}}/token-mint/out && echo "Contracts already compiled, skipping." || just compile-contracts

# Check that COMPACTC is set and valid
_check-compactc:
    @test -n "${COMPACTC:-}" || (echo "Error: COMPACTC environment variable not set." && echo "First, unzip the correct archive for your platform to your home directory:" && echo "  unzip tools/compactc/compactc_v0.28.0_aarch64-darwin.zip -d ~/compactc_v0.28.0" && echo "Then set the COMPACTC environment variable:" && echo "  export COMPACTC=~/compactc_v0.28.0/compactc" && exit 1)
    @test -f "$COMPACTC" || (echo "Error: COMPACTC path does not exist: $COMPACTC" && exit 1)
    @"$COMPACTC" --version | grep -q "0.28.0" || (echo "Error: COMPACTC version mismatch. Required: 0.28.0" && exit 1)

# Copy compiled ZK assets to webapp public directory
_copy-zk-assets:
    bun run --filter @capacity-exchange/example-webapp copy-zk-assets

# Install dependencies
install:
    bun install

# Compile Compact contracts
compile-contracts: _check-compactc
    bun run --cwd {{contracts_dir}} compile

# Build workspace packages (client, components) needed by contracts at runtime
_build-ws:
    bun run --filter @capacity-exchange/client --filter @capacity-exchange/components build

# One-time setup: install deps, compile contracts, copy assets, build, and deploy
setup networkId: install _compile-contracts-if-needed _copy-zk-assets _build-ws (deploy networkId)
    @echo "Setup complete. Run 'just dev' to start the dev server."

# Build all packages
build: install
    bun run --filter '*' build

# Build components and run dev server
dev: install _build-ws
    bun run --filter @capacity-exchange/example-webapp dev

# Run tests
test: install
    bun run --if-present --filter '*' test

# Deploy all contracts for a network
deploy networkId:
    bun run --cwd {{contracts_dir}} deploy-all {{networkId}}

# Lint and format check
check:
    bun run check

# Lint and format fix
fix:
    bun run fix

# Clean build artifacts
clean:
    bun run --filter '*' clean
    rm -rf node_modules
