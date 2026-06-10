/**
 * Sponsor Fallback smoke test runner.
 *
 * This test runs the sponsor flow against a no-dust CES server (NO_DUST_CES_URL)
 * but obtains DUST from its configured peer and complete the sponsorship.
 *
 * The user submits to Server 1 via the /sponsored-transactions endpoint. Server 1
 * has no DUST falls back to Server 2, paying it with shielded or unshielded tokens.
 * The end user does not select a payment currency.
 *
 * Required environment variables:
 *   NETWORK_ID               — Midnight network (e.g. "preview")
 *   NO_DUST_CES_URL          — URL of the no-dust CES server under test
 *   TOKEN_MINT_ADDRESS       — deployed token-mint contract address
 *   CHAIN_SNAPSHOT_DIR       — used as sync start point; wallet state is in-memory only
 *   SPONSOR_WALLET_MNEMONIC  — ephemeral wallet mnemonic (needs no DUST)
 *   WALLET_SYNC_TIMEOUT_MS   — max ms to wait for wallet sync (default: 25 min)
 *
 * Invoked by scripts/ci-fallback-test.sh.
 */
import {
  runCli,
  resolveEnv,
  requireEnvVar,
  loadChainSnapshot,
  createLogger,
} from '@sundaeswap/capacity-exchange-nodejs';
import { toNetworkIdEnum } from '@sundaeswap/capacity-exchange-core';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { runSponsorFlow } from './flows/sponsor-flow.js';
import { requireEnvSeed, type FlowCtxConfig } from './util/testUtils.js';

const logger = createLogger(import.meta);

async function main() {
  const env = resolveEnv();
  const networkId = requireEnvVar(env, 'NETWORK_ID');
  const noDustCesUrl = requireEnvVar(env, 'NO_DUST_CES_URL');
  const tokenMintAddress = requireEnvVar(env, 'TOKEN_MINT_ADDRESS');
  const chainSnapshotDir = requireEnvVar(env, 'CHAIN_SNAPSHOT_DIR');

  setNetworkId(toNetworkIdEnum(networkId));

  const chainSnapshot = loadChainSnapshot(networkId, chainSnapshotDir);
  if (!chainSnapshot) {
    logger.info(`No cached chain snapshot in ${chainSnapshotDir} — wallet will sync from genesis`);
  }

  const flowConfig: FlowCtxConfig = {
    seed: requireEnvSeed(env, 'SPONSOR_WALLET'),
    stateSource: { kind: 'inMemory', chainSnapshot },
  };

  const result = await runSponsorFlow(networkId, flowConfig, tokenMintAddress, noDustCesUrl);
  logger.info({ result }, 'Sponsor Fallback test passed');
  return result;
}

runCli(main, { pretty: true });
