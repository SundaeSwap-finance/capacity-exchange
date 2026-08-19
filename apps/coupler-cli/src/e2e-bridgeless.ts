import * as crypto from 'crypto';
import { createLogger, AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { uint8ArrayToHex, type Logger } from '@sundaeswap/capacity-exchange-core';
import type { CouplingCommitment } from './couplingOutcome.js';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import type { FinalizedTransaction } from '@midnight-ntwrk/ledger-v8';
import type { ZKConfigProvider } from '@midnight-ntwrk/midnight-js/types';
import {
  indexerChainStateProvider,
  type CapacityExchangeConfig,
  type CurrencySelectionResult,
} from '@sundaeswap/capacity-exchange-providers';
import {
  createCapacityExchangeWalletProvider,
  type CesApiResolver,
  type CesApi,
} from '@sundaeswap/capacity-exchange-providers/testing';
import {
  createBridgelessPayer,
  type CapacityFragment,
  type CouplerContext,
  type EscrowLocker,
  type EscrowLockParams,
  type EscrowRef,
  type ForeignCapacity,
} from '@sundaeswap/capacity-exchange-coupler/operations';
import { localCapacityProvider } from './localLp.js';
import { COUPLER_OUT_DIR } from './compiledContract.js';
import { buildCounterIncrementTx } from './counter.js';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { getLedgerParameters } from '@sundaeswap/capacity-exchange-core';
import { inMemoryPrivateStateProvider } from '@sundaeswap/capacity-exchange-core';

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

/** The currency type the fake exchange quotes, so balanceTx takes the bridgeless path. */
export const CARDANO = 'cardano:';
/** Dust the LP funds per coupling, in specks. */
export const VFEE_SPECKS = 1n;
const QUOTED_LOVELACE = '1000000';

/** The escrow ref the stub locker hands back: just the hashlock, so the stub LP can check the
 *  request against the escrow it is funding. */
interface StubEscrowRef {
  h: Uint8Array;
}

/** A fake cap-ex exchange quoting ADA. The only thing the e2e fakes: it feeds a `cardano:` price
 *  through the real balanceTx selection path so the bridgeless payer runs. */
function fakeCardanoResolver(): CesApiResolver {
  const api = {
    apiPricesGet: async () => ({
      quoteId: crypto.randomUUID(),
      prices: [{ amount: QUOTED_LOVELACE, currency: { id: 'ada', type: CARDANO, rawId: '' } }],
    }),
  } as unknown as CesApi['api'];
  const cesApi: CesApi = { url: 'fake://cardano-exchange', api };
  return async () => [cesApi];
}

/** In-memory escrow, idempotent on h: a second lock for the same h returns the first ref. */
export function inMemoryEscrowLocker(): EscrowLocker {
  const byH = new Map<string, EscrowRef>();
  return {
    lock: async (params: EscrowLockParams): Promise<EscrowRef> => {
      const key = uint8ArrayToHex(params.h);
      const existing = byH.get(key);
      if (existing) {
        return existing;
      }
      const ref: EscrowRef = { h: params.h } satisfies StubEscrowRef;
      byH.set(key, ref);
      return ref;
    },
  };
}

/** A ForeignCapacity that also reports the dust it spent, for the harness's own assertions. */
export interface EscrowCheckingCapacity extends ForeignCapacity {
  usedDustUtxos(): string[];
  /** The (h, h') of every coupling this LP actually funded, which is what it would hold in its
   *  own escrow index. A disclosure read is resolved against these, never against position. */
  fundedCommitments(): CouplingCommitment[];
}

/** Stub LP capacity: the LP funds dust only for the escrow it can verify. It checks the request's
 *  h against the escrow ref (trusting the escrow, not the caller's claim), then builds the real
 *  dust fragment via the in-process LP. */
export function escrowCheckingCapacity(ctx: AppContext): EscrowCheckingCapacity {
  const local = localCapacityProvider(ctx);
  const funded: CouplingCommitment[] = [];
  return {
    usedDustUtxos: () => local.usedDustUtxos(),
    fundedCommitments: () => [...funded],
    requestCapacity: async (couplerAddress, request, escrowRef, _quote): Promise<CapacityFragment> => {
      const escrowH = (escrowRef as StubEscrowRef).h;
      if (uint8ArrayToHex(escrowH) !== uint8ArrayToHex(request.h)) {
        throw new Error('capacity: request.h does not match the locked escrow');
      }
      funded.push({ h: request.h, hPrime: request.hPrime });
      return local.requestCapacity(couplerAddress, request);
    },
  };
}

export interface BridgelessE2eDeps {
  /** The LP, funds the dust. */
  ctx: AppContext;
  /** The user, a fresh empty wallet, funds nothing. */
  userApp: AppContext;
  couplerAddress: string;
  counterAddress: string;
  /** Shared across couplings so its idempotency is real. */
  escrow: EscrowLocker;
  /** Shared across couplings so the LP does not hand out the same dust UTXO twice. */
  capacity: ForeignCapacity;
}

/** Build the real capacityExchangeWalletProvider for the user, wired so the only foreign currency
 *  is the fake ADA quote and the bridgeless payer runs the coupler with stubbed escrow and LP. */
function buildWalletProvider(deps: BridgelessE2eDeps) {
  const { userApp, couplerAddress, escrow, capacity } = deps;
  const context = couplerContextFromAppContext(userApp, new NodeZkConfigProvider(COUPLER_OUT_DIR), logger);
  // The SDK owns this choice. In-memory is right for a harness whose swaps complete inside
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
  return createCapacityExchangeWalletProvider(config, fakeCardanoResolver());
}

/** Run one coupling exactly as a dapp would: build a normal op, hand it to `balanceTx`, get a
 *  bound tx back. Returns the bound tx so the caller can submit two in one block. */
export async function prepareCoupling(deps: BridgelessE2eDeps): Promise<FinalizedTransaction> {
  const walletProvider = buildWalletProvider(deps);
  const userTx = await buildCounterIncrementTx(deps.userApp, deps.counterAddress);
  return walletProvider.balanceTx(userTx);
}
