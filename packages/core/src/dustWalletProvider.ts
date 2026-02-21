import {
  CoinPublicKey,
  DustSecretKey,
  EncPublicKey,
  FinalizedTransaction,
  ZswapSecretKeys,
} from '@midnight-ntwrk/ledger-v7';
import { UnboundTransaction, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';

export class DustWalletProvider implements WalletProvider {
  #wallet: WalletFacade;
  #zswapSecretKeys: ZswapSecretKeys;
  #dustSecretKey: DustSecretKey;

  constructor(wallet: WalletFacade, zswap: ZswapSecretKeys, dust: DustSecretKey) {
    this.#wallet = wallet;
    this.#zswapSecretKeys = zswap;
    this.#dustSecretKey = dust;
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.#zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.#zswapSecretKeys.encryptionPublicKey;
  }

  async balanceTx(tx: UnboundTransaction, ttl?: Date): Promise<FinalizedTransaction> {
    const now = new Date();
    const realTtl = ttl ?? new Date(now.getTime() + 5 * 1000 * 60);
    const recipe = await this.#wallet.balanceUnboundTransaction(
      tx,
      { shieldedSecretKeys: this.#zswapSecretKeys, dustSecretKey: this.#dustSecretKey },
      { ttl: realTtl }
    );
    const finalized = await this.#wallet.finalizeRecipe(recipe);
    return finalized;
  }
}
