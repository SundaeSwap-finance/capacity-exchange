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

  /** Creates a ZswapOffer tx. */
  async createShieldedOfferTx(
    rawId: string,
    value: bigint,
    dust: UnprovenDustSpend,
    ctime: Date,
    ttl: Date,
    segmentId?: number,
  ): Promise<UnboundTransaction> {
    const intent = this.buildDustIntent(dust, ctime, ttl);
    const coin = createShieldedCoinInfo(rawId, value);
    const output = ZswapOutput.new(
      coin,
      segmentId ?? 0,
      this.#zswap.coinPublicKey,
      this.#zswap.encryptionPublicKey,
    );
    const offer = ZswapOffer.fromOutput(output, coin.type, coin.value);
    const tx =
      segmentId !== undefined
        ? Transaction.fromParts(this.#networkId, offer, undefined, intent)
        : Transaction.fromPartsRandomized(this.#networkId, offer, undefined, intent);
    return this.proveTx(tx);
  }

  /** Creates a UtxoOutput tx. `serverAddress` is where the unshielded tokens are sent. */
  async createUnshieldedOfferTx(
    rawId: string,
    value: bigint,
    dust: UnprovenDustSpend,
    ctime: Date,
    ttl: Date,
    serverAddress: UserAddress,
  ): Promise<UnboundTransaction> {
    const intent = this.buildDustIntent(dust, ctime, ttl);
    const utxoOutput: UtxoOutput = { value, owner: serverAddress, type: rawId };
    intent.guaranteedUnshieldedOffer = UnshieldedOffer.new([], [utxoOutput], []);
    const tx = Transaction.fromPartsRandomized(this.#networkId, undefined, undefined, intent);
    return this.proveTx(tx);
  }
}
