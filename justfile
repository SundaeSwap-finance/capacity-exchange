contracts_dir := "packages/example-webapp/contracts"
webapp_dir := "packages/example-webapp"

# Check that COMPACTC is set and valid
_check-compactc:
    @test -n "${COMPACTC:-}" || (echo "Error: COMPACTC environment variable not set." && echo "Set it to the path of the compactc binary, e.g.:" && echo "  export COMPACTC=$(pwd)/tools/compactc/compactc_v0.26.108-rc.0-UT-L6" && exit 1)
    @test -f "$COMPACTC" || (echo "Error: COMPACTC path does not exist: $COMPACTC" && exit 1)
    @"$COMPACTC" --version | grep -q "0.26.108" || (echo "Error: COMPACTC version mismatch. Required: 0.26.108" && exit 1)

# Check that setup has been run
_check-setup:
    @test -d {{webapp_dir}}/public/midnight/counter/keys || (echo "Error: counter ZK assets not found. Run 'just setup <networkId>' first." && exit 1)
    @test -d {{webapp_dir}}/public/midnight/token-mint/keys || (echo "Error: token-mint ZK assets not found. Run 'just setup <networkId>' first." && exit 1)

# Copy compiled ZK assets to webapp public directory
_copy-zk-assets:
    mkdir -p {{webapp_dir}}/public/midnight/counter/keys {{webapp_dir}}/public/midnight/counter/zkir
    cp -r {{contracts_dir}}/counter/out/keys/* {{webapp_dir}}/public/midnight/counter/keys/
    cp -r {{contracts_dir}}/counter/out/zkir/* {{webapp_dir}}/public/midnight/counter/zkir/
    mkdir -p {{webapp_dir}}/public/midnight/token-mint/keys {{webapp_dir}}/public/midnight/token-mint/zkir
    cp -r {{contracts_dir}}/token-mint/out/keys/* {{webapp_dir}}/public/midnight/token-mint/keys/
    cp -r {{contracts_dir}}/token-mint/out/zkir/* {{webapp_dir}}/public/midnight/token-mint/zkir/

# Install dependencies
install:
    npm install
    npm install --prefix {{contracts_dir}}

# Compile Compact contracts
compile-contracts: _check-compactc
    npm run compile --prefix {{contracts_dir}}

# One-time setup: install deps, compile contracts, copy assets, and deploy
setup networkId: install compile-contracts _copy-zk-assets (deploy-all networkId)
    @echo "Setup complete. Run 'just dev' to start the dev server."

# Build all packages
build: _check-setup
    npm run build -ws --if-present

# Build components and run dev server
dev: _check-setup
    npm run build --workspace=packages/components
    npx concurrently --kill-others-on-fail "npm:build:watch --workspace=@capacity-exchange/components" "npm:dev --workspace=@capacity-exchange/example-webapp"

# Run tests
test:
    npm run test -ws --if-present

# Deploy all contracts for a network
deploy-all networkId:
    npm run deploy-all --prefix {{contracts_dir}} -- {{networkId}}

# Lint and format check
check:
    npx eslint . && npx prettier --check .

# Lint and format fix
fix:
    npx eslint . --fix && npx prettier --write .

# Setup, build, and run dev server
do-it-all networkId: (setup networkId) build dev

# Clean build artifacts
clean:
    npm run clean -ws --if-present
    npm run clean --prefix {{contracts_dir}}
    rm -rf {{webapp_dir}}/public/midnight
    rm -rf {{contracts_dir}}/.midnight-private-state
    rm -rf {{contracts_dir}}/.midnight-wallet-state
    rm -f {{contracts_dir}}/.contracts.*.json
