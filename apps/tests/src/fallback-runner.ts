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
