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
    npm run copy-zk-assets --workspace=@capacity-exchange/example-webapp

# Install dependencies
install:
    npm install

# Compile Compact contracts
compile-contracts: _check-compactc
    npm run compile --prefix {{contracts_dir}}

# Build workspace packages (client, components) needed by contracts at runtime
_build-ws:
    npm run build -ws --if-present --workspace=packages/client --workspace=packages/components

# One-time setup: install deps, compile contracts, copy assets, build, and deploy
setup networkId: install _compile-contracts-if-needed _copy-zk-assets _build-ws (deploy networkId)
    @echo "Setup complete. Run 'just dev' to start the dev server."

# Build all packages
build:
    npm run build -ws --if-present

# Build components and run dev server
dev: install _build-ws
    npm run dev --workspace=@capacity-exchange/example-webapp

# Run tests
test:
    npm run test -ws --if-present

# Deploy all contracts for a network
deploy networkId:
    npm run deploy-all --prefix {{contracts_dir}} -- {{networkId}}

# Lint and format check
check:
    npm run check

# Lint and format fix
fix:
    npm run fix

# Clean build artifacts
clean:
    npm run clean -ws --if-present
    rm -rf node_modules
