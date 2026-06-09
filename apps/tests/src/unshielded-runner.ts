/**
 * Standalone runner: exercises only the unshielded exchange flow against a
 * preview-pointed CES. Intentionally separate from `runner.ts` so we can iterate
 * without disturbing the existing sponsor / exchange / registry flows.
 *
 * Required env:
 *   NETWORK_ID                                  e.g. preview
 *   CES_URL                                     e.g. http://localhost:3000
 *   COUNTER_ADDRESS                             counter contract address
 *   CHAIN_SNAPSHOT_DIR                          directory with cached chain snapshots
 *   EXCHANGE_WALLET_MNEMONIC or ..._SEED        user wallet credentials
 *   CES_SERVER_WALLET_MNEMONIC or ..._SEED      CES server wallet credentials
 *   UNSHIELDED_TOKEN_COLOR                      unshielded token rawId the user is paying with
 */
import { runCli, resolveEnv, createLogger, requireEnvVar } from '@sundaeswap/capacity-exchange-nodejs';
import { toNetworkIdEnum } from '@sundaeswap/capacity-exchange-core';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { getBaseTestConfig } from './config.js';
import { runUnshieldedExchangeFlow, type UnshieldedExchangeFlowResult } from './flows/exchange-flow.js';

const logger = createLogger(import.meta);

async function main(): Promise<UnshieldedExchangeFlowResult> {
  const env = resolveEnv();
  const config = getBaseTestConfig(env);
  const tokenRawId = requireEnvVar(env, 'UNSHIELDED_TOKEN_COLOR');

  setNetworkId(toNetworkIdEnum(config.networkId));
  if (!config.chainSnapshot) {
    logger.info(
      { chainSnapshotDir: config.chainSnapshotDir },
      'No cached chain snapshot, wallets will sync from genesis'
    );
  }

  const result = await runUnshieldedExchangeFlow(
    config.networkId,
    config.exchangeFlowConfig,
    config.cesServerFlowConfig,
    config.counterAddress,
    config.cesUrl,
    tokenRawId
  );
  logger.info(result, 'Unshielded exchange flow result');
  return result;
}

runCli(main, { pretty: true });
