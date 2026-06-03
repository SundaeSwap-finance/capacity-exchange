import {
  DustActions,
  Intent,
  PreProof,
  createShieldedCoinInfo,
  SignatureEnabled,
  Transaction,
  UnshieldedOffer,
  type UnprovenIntent,
  type UnprovenTransaction,
  type UserAddress,
  type UtxoOutput,
  ZswapOffer,
  ZswapOutput,
  ZswapSecretKeys,
} from '@midnight-ntwrk/ledger-v8';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import {
  ProofProvider,
  ZKConfigProvider,
  type UnboundTransaction,
} from '@midnight-ntwrk/midnight-js-types';
import type { UnprovenDustSpend } from '@midnight-ntwrk/wallet-sdk-dust-wallet/v1';
import type { RawCurrency } from '../config/prices.js';

// The server's dust-spend txs don't take zk config / circuit artifacts.
class EmptyZKConfigProvider extends ZKConfigProvider<never> {
  getZKIR(): Promise<never> {
    throw new Error('No ZK circuits in dust transactions');
  }
  getProverKey(): Promise<never> {
    throw new Error('No ZK circuits in dust transactions');
  }
  getVerifierKey(): Promise<never> {
    throw new Error('No ZK circuits in dust transactions');
  }
}

export class TxService {
  readonly #networkId: string;
  readonly #zswap: ZswapSecretKeys;
  readonly #proofProvider: ProofProvider;

  constructor(networkId: string, zswap: ZswapSecretKeys, proofProviderUrl: string) {
    this.#networkId = networkId;
    this.#zswap = zswap;
    this.#proofProvider = httpClientProofProvider(proofProviderUrl, new EmptyZKConfigProvider());
  }

  buildDustIntent(dust: UnprovenDustSpend, ctime: Date, ttl: Date): UnprovenIntent {
    const intent = Intent.new(ttl);
    intent.dustActions = new DustActions<SignatureEnabled, PreProof>(
      'signature',
      'pre-proof',
      ctime,
      [dust],
    );
    return intent;
  }

  async proveTx(tx: UnprovenTransaction): Promise<UnboundTransaction> {
    return this.#proofProvider.proveTx(tx);
  }

  async createDustOnlyTx(
    dust: UnprovenDustSpend,
    ctime: Date,
    ttl: Date,
  ): Promise<UnboundTransaction> {
    const intent = this.buildDustIntent(dust, ctime, ttl);
    const tx = Transaction.fromPartsRandomized(this.#networkId, undefined, undefined, intent);
    return this.proveTx(tx);
  }

  /**
   * Build an offer tx: server sponsors DUST for the user and promises payment
   * in `currency`/`value`, routed by `currency.type`:
   * - `midnight:shielded` — creates a ZswapOffer (shielded output); `serverAddress` is ignored.
   * - `midnight:unshielded` — creates a UtxoOutput addressed to `serverAddress`; must be provided.
   */
  async createOfferTx(
    currency: RawCurrency,
    value: bigint,
    dust: UnprovenDustSpend,
    ctime: Date,
    ttl: Date,
    serverAddress?: UserAddress,
  ): Promise<UnboundTransaction> {
    const intent = this.buildDustIntent(dust, ctime, ttl);
    let tx: UnprovenTransaction;
    if (currency.type === 'midnight:shielded') {
      const coin = createShieldedCoinInfo(currency.rawId, value);
      const output = ZswapOutput.new(
        coin,
        0,
        this.#zswap.coinPublicKey,
        this.#zswap.encryptionPublicKey,
      );
      tx = Transaction.fromPartsRandomized(
        this.#networkId,
        ZswapOffer.fromOutput(output, coin.type, coin.value),
        undefined,
        intent,
      );
    } else {
      const utxoOutput: UtxoOutput = { value, owner: serverAddress!, type: currency.rawId };
      intent.guaranteedUnshieldedOffer = UnshieldedOffer.new([], [utxoOutput], []);
      tx = Transaction.fromPartsRandomized(this.#networkId, undefined, undefined, intent);
    }
    return this.proveTx(tx);
  }
}
