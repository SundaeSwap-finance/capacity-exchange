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
  readonly #unshieldedAddress: UserAddress;

  constructor(
    networkId: string,
    zswap: ZswapSecretKeys,
    unshieldedAddress: UserAddress,
    proofProviderUrl: string,
  ) {
    this.#networkId = networkId;
    this.#zswap = zswap;
    this.#proofProvider = httpClientProofProvider(proofProviderUrl, new EmptyZKConfigProvider());
    this.#unshieldedAddress = unshieldedAddress;
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
    return this.#buildTx(dust, ctime, ttl, (intent) =>
      Transaction.fromPartsRandomized(this.#networkId, undefined, undefined, intent),
    );
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
    return this.#buildTx(dust, ctime, ttl, (intent) => {
      const coin = createShieldedCoinInfo(rawId, value);
      const output = ZswapOutput.new(
        coin,
        segmentId ?? 0,
        this.#zswap.coinPublicKey,
        this.#zswap.encryptionPublicKey,
      );
      const offer = ZswapOffer.fromOutput(output, coin.type, coin.value);
      return segmentId !== undefined
        ? Transaction.fromParts(this.#networkId, offer, undefined, intent)
        : Transaction.fromPartsRandomized(this.#networkId, offer, undefined, intent);
    });
  }

  /** Creates a UtxoOutput tx. Tokens are sent to the server's unshielded address. */
  async createUnshieldedOfferTx(
    rawId: string,
    value: bigint,
    dust: UnprovenDustSpend,
    ctime: Date,
    ttl: Date,
  ): Promise<UnboundTransaction> {
    return this.#buildTx(dust, ctime, ttl, (intent) => {
      const utxoOutput: UtxoOutput = { value, owner: this.#unshieldedAddress, type: rawId };
      intent.guaranteedUnshieldedOffer = UnshieldedOffer.new([], [utxoOutput], []);
      return Transaction.fromPartsRandomized(this.#networkId, undefined, undefined, intent);
    });
  }

  /** Builds an intent, passes it to `configure` to produce an unproven tx, then proves it. */
  #buildTx(
    dust: UnprovenDustSpend,
    ctime: Date,
    ttl: Date,
    configure: (intent: UnprovenIntent) => UnprovenTransaction,
  ): Promise<UnboundTransaction> {
    const intent = this.buildDustIntent(dust, ctime, ttl);
    return this.proveTx(configure(intent));
  }
}
