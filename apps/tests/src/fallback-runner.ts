/**
 * Sponsor Fallback smoke test runner.
 *
 * Runs the sponsor flow against a no-dust CES server (Server 1). Server 1 has no
 * DUST and falls back to a funded peer (Server 2), paying it with shielded
 * or unshielded tokens. The end user does not select a
 * payment currency — Server 1 auto-selects via its peer price configuration.
 *
 * Required environment variables:
 *   NETWORK_ID                        — Midnight network (e.g. "preview")
 *   NO_DUST_CES_URL                   — URL of the no-dust CES server (Server 1)
 *   TOKEN_MINT_ADDRESS                — deployed token-mint contract address
 *   CHAIN_SNAPSHOT_DIR                — sync start point; wallet state is in-memory only
 *   SPONSOR_WALLET_MNEMONIC or _SEED  — ephemeral sponsor wallet (needs no DUST)
 *   WALLET_SYNC_TIMEOUT_MS            — max ms to wait for wallet sync (default: 25 min)
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
