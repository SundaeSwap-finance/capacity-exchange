/**
 * Sponsor Fallback smoke test runner.
 *
 * Runs two back-to-back sponsor flows against a no-dust CES server (NO_DUST_CES_URL),
 * which obtains DUST from its configured peer on each call:
 *   1. Shielded payment  — user pays with DERIVED_TOKEN_COLOR (midnight:shielded)
 *   2. Unshielded payment — user pays with UNSHIELDED_TOKEN_COLOR (midnight:unshielded)
 *
 * Required environment variables:
 *   NETWORK_ID                 — Midnight network (e.g. "preview")
 *   NO_DUST_CES_URL            — URL of the no-dust CES server under test
 *   TOKEN_MINT_ADDRESS         — deployed token-mint contract address
 *   CHAIN_SNAPSHOT_DIR         — used as sync start point; wallet state is in-memory only
 *   SPONSOR_WALLET_MNEMONIC    — ephemeral wallet mnemonic (needs both shielded + unshielded tokens, no DUST)
 *   DERIVED_TOKEN_COLOR        — rawId of the shielded token used to pay for DUST
 *   UNSHIELDED_TOKEN_COLOR     — rawId of the unshielded token used to pay for DUST
 *   WALLET_SYNC_TIMEOUT_MS     — max ms to wait for wallet sync (default: 25 min)
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
  const shieldedTokenColor = requireEnvVar(env, 'DERIVED_TOKEN_COLOR');
  const unshieldedTokenColor = requireEnvVar(env, 'UNSHIELDED_TOKEN_COLOR');

  setNetworkId(toNetworkIdEnum(networkId));

  const chainSnapshot = loadChainSnapshot(networkId, chainSnapshotDir);
  if (!chainSnapshot) {
    logger.info(`No cached chain snapshot in ${chainSnapshotDir} — wallet will sync from genesis`);
  }

  const makeFlowConfig = (): FlowCtxConfig => ({
    seed: requireEnvSeed(env, 'SPONSOR_WALLET'),
    stateSource: { kind: 'inMemory', chainSnapshot },
  });

  logger.info('Running fallback test 1/2: shielded payment');
  const shieldedResult = await runSponsorFlow(networkId, makeFlowConfig(), tokenMintAddress, noDustCesUrl, undefined, {
    paymentTokenRawId: shieldedTokenColor,
  });
  logger.info({ result: shieldedResult }, 'Fallback test 1/2 (shielded) passed');

  logger.info('Running fallback test 2/2: unshielded payment');
  const unshieldedResult = await runSponsorFlow(
    networkId,
    makeFlowConfig(),
    tokenMintAddress,
    noDustCesUrl,
    undefined,
    { paymentTokenRawId: unshieldedTokenColor }
  );
  logger.info({ result: unshieldedResult }, 'Fallback test 2/2 (unshielded) passed');

  return { shielded: shieldedResult, unshielded: unshieldedResult };
}

runCli(main, { pretty: true });
