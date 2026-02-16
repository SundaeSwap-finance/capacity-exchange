import {
  DustActions,
  Intent,
  PreProof,
  ShieldedCoinInfo,
  SignatureEnabled,
  Transaction,
  ZswapOffer,
  ZswapOutput,
  ZswapSecretKeys,
} from '@midnight-ntwrk/ledger-v6';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { ProofProvider, ProvenTransaction } from '@midnight-ntwrk/midnight-js-types';
import { UnprovenDustSpend } from '@midnight-ntwrk/wallet-sdk-dust-wallet';

export class TxService {
  readonly #networkId: string;
  readonly #zswap: ZswapSecretKeys;
  readonly #proofProvider: ProofProvider<string>;

  constructor(networkId: string, zswap: ZswapSecretKeys, proofProviderUrl: string) {
    this.#networkId = networkId;
    this.#zswap = zswap;
    this.#proofProvider = httpClientProofProvider(proofProviderUrl);
  }

  async createFundingTx(
    coin: ShieldedCoinInfo,
    dust: UnprovenDustSpend,
    ttl: Date,
    segmentId?: number,
  ): Promise<ProvenTransaction> {
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
    const tx = segmentId
      ? Transaction.fromParts(this.#networkId, offer, undefined, intent)
      : Transaction.fromPartsRandomized(this.#networkId, offer, undefined, intent);
    return this.#proofProvider.proveTx(tx);
  }
}
