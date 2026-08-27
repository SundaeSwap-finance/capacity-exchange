import { createLogger, AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { getLedgerParameters, inMemoryPrivateStateProvider, type Logger } from '@sundaeswap/capacity-exchange-core';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { FinalizedTransaction } from '@midnight-ntwrk/ledger-v8';
import type { UnboundTransaction, ZKConfigProvider } from '@midnight-ntwrk/midnight-js/types';
import {
  indexerChainStateProvider,
  type CapacityExchangeConfig,
  type CurrencySelectionResult,
} from '@sundaeswap/capacity-exchange-providers';
import {
  createCapacityExchangeWalletProvider,
  type CesApiResolver,
} from '@sundaeswap/capacity-exchange-providers/testing';
import {
  createBridgelessPayer,
  type CouplerContext,
  type EscrowLocker,
  type ForeignCapacity,
} from '@sundaeswap/capacity-exchange-coupler/operations';
import { COUPLER_OUT_DIR } from '../chain/contract.js';

const logger = createLogger(import.meta);

/** Builds a CouplerContext from an AppContext, a zk-keys source, and a logger. */
export function couplerContextFromAppContext(
  ctx: AppContext,
  zkConfigProvider: ZKConfigProvider<string>,
  logger: Logger
): CouplerContext {
  return {
    coinPublicKey: ctx.walletContext.walletProvider.getCoinPublicKey(),
    publicDataProvider: ctx.publicDataProvider,
    midnightProvider: ctx.midnightProvider,
    proofProvider: httpClientProofProvider(ctx.config.network.endpoints.proofServerUrl, zkConfigProvider),
    getLedgerParameters: () => getLedgerParameters(ctx.config.network.endpoints.indexerHttpUrl),
    logger,
  };
}

/** The currency type a bridgeless coupling pays in, so balanceTx takes the bridgeless path. */
export const CARDANO = 'cardano:';

/** What preparing a coupling needs. The escrow, the capacity, and the exchange are injected: an
 *  e2e supplies stubs to hold the LP constant, and a real run supplies a live CES. */
export interface CouplingDeps {
  /** The payer, whose transaction is being funded by coupling. */
  userApp: AppContext;
  couplerAddress: string;
  escrow: EscrowLocker;
  capacity: ForeignCapacity;
  resolver: CesApiResolver;
}

/** The real capacityExchangeWalletProvider, wired so the only foreign currency is the quoted ADA
 *  and the bridgeless payer runs the coupler against the injected escrow and capacity. */
function buildWalletProvider(deps: CouplingDeps) {
  const { userApp, couplerAddress, escrow, capacity } = deps;
  const context = couplerContextFromAppContext(userApp, new NodeZkConfigProvider(COUPLER_OUT_DIR), logger);
  // The SDK owns this choice. In-memory is right for a caller whose swaps complete inside
  // one process. Production supplies a durable store so a failed submit can be retried.
  const payer = createBridgelessPayer({
    context,
    couplerAddress,
    escrow,
    capacity,
    privateStateProvider: inMemoryPrivateStateProvider(),
  });
  const endpoints = userApp.config.network.endpoints;
  const config: CapacityExchangeConfig = {
    networkId: userApp.config.network.networkName,
    coinPublicKey: userApp.walletContext.walletProvider.getCoinPublicKey(),
    encryptionPublicKey: userApp.walletContext.walletProvider.getEncryptionPublicKey(),
    balanceUnsealedTransaction: async () => {
      throw new Error('native balance unused on the cardano path');
    },
    balanceSealedTransaction: async () => {
      throw new Error('native balance unused on the cardano path');
    },
    chainStateProvider: indexerChainStateProvider(endpoints.indexerHttpUrl, endpoints.indexerWsUrl),
    promptForCurrency: async (prices): Promise<CurrencySelectionResult> => {
      const ada = prices.find((p) => p.price.currency.type === CARDANO);
      return ada ? { status: 'selected', exchangePrice: ada } : { status: 'no-eligible' };
    },
    confirmOffer: async () => ({ status: 'confirmed' }),
    bridgelessPayers: { [CARDANO]: payer },
  };
  return createCapacityExchangeWalletProvider(config, deps.resolver);
}

/** Fund one transaction by coupling, exactly as a dapp would: hand a normal op to `balanceTx` and
 *  get a bound tx back. Returns the bound tx so the caller decides when and how to submit. */
export async function prepareCoupling(deps: CouplingDeps, userTx: UnboundTransaction): Promise<FinalizedTransaction> {
  return buildWalletProvider(deps).balanceTx(userTx);
}
