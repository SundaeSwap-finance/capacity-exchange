import {
  DustActions,
  Intent,
  PreProof,
  ShieldedCoinInfo,
  SignatureEnabled,
  Transaction,
  type UnprovenIntent,
  type UnprovenTransaction,
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

  async createOfferTx(
    coin: ShieldedCoinInfo,
    dust: UnprovenDustSpend,
    ctime: Date,
    ttl: Date,
    segmentId?: number,
  ): Promise<UnboundTransaction> {
    const SEGMENT = 0;
    const output = ZswapOutput.new(
      coin,
      SEGMENT,
      this.#zswap.coinPublicKey,
      this.#zswap.encryptionPublicKey,
    );
    const offer = ZswapOffer.fromOutput(output, coin.type, coin.value);
    const intent = this.buildDustIntent(dust, ctime, ttl);

    // TODO: pass in segmentId when we can
    const tx = segmentId
      ? Transaction.fromParts(this.#networkId, offer, undefined, intent)
      : Transaction.fromPartsRandomized(this.#networkId, offer, undefined, intent);
    return this.proveTx(tx);
  }
}
