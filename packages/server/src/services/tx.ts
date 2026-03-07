import {
  createShieldedCoinInfo,
  DustActions,
  Intent,
  PreBinding,
  PreProof,
  ShieldedCoinInfo,
  SignatureEnabled,
  Transaction,
  UnprovenTransaction,
  UnshieldedOffer,
  UserAddress,
  UtxoOutput,
  ZswapOffer,
  ZswapOutput,
  ZswapSecretKeys,
} from '@midnight-ntwrk/ledger-v7';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import {
  ProofProvider,
  ZKConfigProvider,
  type UnboundTransaction,
} from '@midnight-ntwrk/midnight-js-types';
import { UnprovenDustSpend } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { TokenType } from './price';

// The server's dust-spend txs don't take zk config / circuit artifacts.
class EmptyZKConfigProvider extends ZKConfigProvider<never> {
  getZKIR(): Promise<never> {
    throw new Error('No ZK circuits in funding transactions');
  }
  getProverKey(): Promise<never> {
    throw new Error('No ZK circuits in funding transactions');
  }
  getVerifierKey(): Promise<never> {
    throw new Error('No ZK circuits in funding transactions');
  }
}

export class TxService {
  readonly #networkId: string;
  readonly #zswap: ZswapSecretKeys;
  readonly #unshielded: UserAddress;
  readonly #proofProvider: ProofProvider;

  constructor(
    networkId: string,
    zswap: ZswapSecretKeys,
    unshielded: UserAddress,
    proofProviderUrl: string,
  ) {
    this.#networkId = networkId;
    this.#zswap = zswap;
    this.#unshielded = unshielded;
    this.#proofProvider = httpClientProofProvider(proofProviderUrl, new EmptyZKConfigProvider());
  }

  async createFundingTx(
    tokenType: TokenType,
    token: string,
    amount: bigint,
    dust: UnprovenDustSpend,
    ttl: Date,
    segmentId?: number,
  ): Promise<UnboundTransaction> {
    if (tokenType === 'unshielded') {
      const output = {
        type: token,
        value: amount,
        owner: this.#unshielded,
      };
      return this.#createUnshieldedFundingTx(output, dust, ttl, segmentId);
    }
    if (tokenType === 'shielded') {
      const coin = createShieldedCoinInfo(token, amount);
      return this.#createShieldedFundingTx(coin, dust, ttl, segmentId);
    }
    throw new Error(`invalid token type: expected "shielded" or "unshielded", got "${tokenType}"`);
  }

  async #createUnshieldedFundingTx(
    output: UtxoOutput,
    dust: UnprovenDustSpend,
    ttl: Date,
    segmentId?: number,
  ): Promise<UnboundTransaction> {
    const intent = Intent.new(ttl);
    intent.guaranteedUnshieldedOffer = UnshieldedOffer.new([], [output], []);
    intent.dustActions = new DustActions<SignatureEnabled, PreProof>(
      'signature',
      'pre-proof',
      new Date(),
      [dust],
    );

    return this.#buildTx(intent, undefined, segmentId);
  }

  async #createShieldedFundingTx(
    coin: ShieldedCoinInfo,
    dust: UnprovenDustSpend,
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

    const intent = Intent.new(ttl);
    intent.dustActions = new DustActions<SignatureEnabled, PreProof>(
      'signature',
      'pre-proof',
      new Date(),
      [dust],
    );
    // TODO: pass in segmentId when we can
    return this.#buildTx(intent, offer, segmentId);
  }

  async #buildTx(
    intent: Intent<SignatureEnabled, PreProof, PreBinding>,
    offer?: ZswapOffer<PreProof>,
    segmentId?: number,
  ): Promise<UnboundTransaction> {
    let tx: UnprovenTransaction;
    if (segmentId) {
      tx = Transaction.fromParts(this.#networkId, offer);
      const intents = new Map();
      intents.set(segmentId, intent);
      tx.intents = intents;
    } else {
      tx = Transaction.fromPartsRandomized(this.#networkId, offer, undefined, intent);
    }
    return this.#proofProvider.proveTx(tx);
  }
}
