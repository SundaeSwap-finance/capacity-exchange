# Tests

These tests run the CES sponsor and exchange flows against a local CES server using the CES SDK. The CES server can be configured to run against any environment: completely mocked dependencies, local devnet (`undeployed`), `preview`, `preprod`, or `mainnet`. The test suite is env-agnostic and parameterized so it can run locally during dev, in gh actions, in aws pipelines, or in a canary. The difference is the infra underneath and env setup.

## One-time environment setup

To set up for a new env you need to:
1. fund a wallet with NIGHT and register it for DUST generation (this is used for deploying contracts and also as the CES hot wallet),
2. deploy the counter and token-mint contracts, and
3. set your env vars

### 1. Getting funds

How to get funds depends on the env.

- **Local devnet / `undeployed`**: Send NIGHT from the genesis seeds (`{63}0..1`, `{63}0..2`, `{63}0..3`) or use a genesis wallet directly
- **Preview / preprod**: Use the faucet (https://faucet.preview.midnight.network/ or https://faucet.preprod.midnight.network/)
- **Mainnet**: Buy or be sent NIGHT

### 2. Registering for DUST and splitting UTxOs

To first deploy contracts and then for CES to sponsor or exchange DUST (the test flows), you need to register your wallet's NIGHT UTxOs for DUST generation. Splitting NIGHT UTxOs isn't necessary for the tests but it's good to mirror actual CES state with multiple UTxOs.

- Create your wallet mnemonic file at `apps/tests/wallet-mnemonic.<env>.txt`
- Split the NIGHT into multiple UTxOs and register for DUST generation:

```sh
bun packages/midnight-node/src/cli/split-night.ts <env> 20
```

### 3. Deploying the contracts

Deploy the counter and token-mint contracts using the same wallet:

```sh
cd apps/demo/contracts
bun src/counter/cli/deploy.ts <env>
bun src/token-mint/cli/deploy.ts <env>
```

The counter deploy outputs `contractAddress` and the token-mint deploy outputs `contractAddress` and `derivedTokenColor`.

### 4. Setting env vars and running

#### Against local devnet / `undeployed`

Bring up the local devnet:

```sh
docker compose -f testnet/standalone.yml up -d
```

Wait for the indexer to be ready:

```sh
timeout 60 bash -c 'until curl -sSf http://localhost:8088/ready; do sleep 2; done'
```

Clear any stale wallet state (the devnet starts fresh each time):

```sh
rm -rf .wallet-state-undeployed apps/server/.wallet-state-ci apps/demo/contracts/.wallet-state-undeployed
```

Deploy contracts (from `apps/demo/contracts/`), then run using a genesis hex seed:

```sh
CES_WALLET_SEED=0000000000000000000000000000000000000000000000000000000000000001 \
REGISTRY_WALLET_SEED=0000000000000000000000000000000000000000000000000000000000000002 \
COUNTER_ADDRESS=<counter-contract-address> \
TOKEN_MINT_ADDRESS=<token-mint-contract-address> \
DERIVED_TOKEN_COLOR=<derived-token-color> \
scripts/ci-test.sh undeployed
```

Tear down when done:

```sh
docker compose -f testnet/standalone.yml down
```

#### Against a live network (preview, preprod, mainnet)

Deploy contracts and run, this uses an already-up CES:

```sh
NETWORK_ID=preview \
CES_URL=http://localhost:3000 \
COUNTER_ADDRESS=<counter-contract-address> \
TOKEN_MINT_ADDRESS=<token-mint-contract-address> \
DERIVED_TOKEN_COLOR=<derived-token-color> \
bun apps/tests/src/runner.ts
```

#### In gh actions

Set the following secrets and vars:

**Secrets:**

```sh
gh secret set CES_WALLET_MNEMONIC_PREVIEW
# paste the mnemonic when prompted
gh secret set REGISTRY_WALLET_MNEMONIC_PREVIEW
# paste the mnemonic when prompted
```

**Variables:**

```sh
gh variable set E2E_COUNTER_ADDRESS_PREVIEW --body "<counter-contract-address>"
gh variable set E2E_TOKEN_MINT_ADDRESS_PREVIEW --body "<token-mint-contract-address>"
gh variable set E2E_DERIVED_TOKEN_COLOR_PREVIEW --body "<derived-token-color>"
```
