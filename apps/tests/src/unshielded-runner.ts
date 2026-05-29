/**
 * Standalone runner: exercises only the unshielded exchange flow against a
 * preview-pointed CES. Intentionally separate from `runner.ts` so we can iterate
 * without disturbing the existing sponsor / exchange / registry flows.
 *
 * Required env:
 *   NETWORK_ID                       e.g. preview
 *   CES_URL                          e.g. http://localhost:3000
 *   COUNTER_ADDRESS                  counter contract address
 *   TUSDM_RAW_ID                     unshielded token rawId the user is paying with
 *   EXCHANGE_WALLET_MNEMONIC         user wallet mnemonic (24 words)
 *   SERVER_WALLET_MNEMONIC_FILE      path to CES server wallet mnemonic file
 *   CHAIN_SNAPSHOT_DIR               directory with cached chain snapshots
 */
import * as fs from 'fs';
import { runCli, resolveEnv, createLogger, loadChainSnapshot, requireEnvVar } from '@sundaeswap/capacity-exchange-nodejs';
import { toNetworkIdEnum } from '@sundaeswap/capacity-exchange-core';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { requireEnvSeed, type WalletSeed } from './util/testUtils.js';
import { runUnshieldedExchangeFlow, type UnshieldedExchangeFlowResult } from './flows/unshielded-exchange-flow.js';

const logger = createLogger(import.meta);

async function main(): Promise<UnshieldedExchangeFlowResult> {
  const env = resolveEnv();
  const networkId = requireEnvVar(env, 'NETWORK_ID');
  const cesUrl = requireEnvVar(env, 'CES_URL');
  const counterAddress = requireEnvVar(env, 'COUNTER_ADDRESS');
  const tokenRawId = requireEnvVar(env, 'TUSDM_RAW_ID');
  const chainSnapshotDir = requireEnvVar(env, 'CHAIN_SNAPSHOT_DIR');
  const serverMnemonicFile = requireEnvVar(env, 'SERVER_WALLET_MNEMONIC_FILE');
  const chainSnapshot = loadChainSnapshot(networkId, chainSnapshotDir);

  const userSeed = requireEnvSeed(env, 'EXCHANGE_WALLET');
  const serverSeed: WalletSeed = { type: 'mnemonic', mnemonic: fs.readFileSync(serverMnemonicFile, 'utf-8').trim() };

  setNetworkId(toNetworkIdEnum(networkId));
  if (!chainSnapshot) {
    logger.info({ chainSnapshotDir }, 'No cached chain snapshot, wallets will sync from genesis');
  }

  const result = await runUnshieldedExchangeFlow(
    networkId,
    { seed: userSeed, stateSource: { kind: 'inMemory', chainSnapshot } },
    { seed: serverSeed, stateSource: { kind: 'inMemory', chainSnapshot } },
    counterAddress,
    cesUrl,
    tokenRawId,
  );
  logger.info(result, 'Unshielded exchange flow result');
  return result;
}

runCli(main, { pretty: true });
