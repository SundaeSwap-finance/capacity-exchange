import type { WalletProvider, ProvingRecipe } from '@midnight-ntwrk/midnight-js-types';
import type {
  CoinPublicKey,
  EncPublicKey,
  FinalizedTransaction,
  ShieldedCoinInfo,
  UnprovenTransaction,
  ZswapSecretKeys,
  DustSecretKey,
} from '@midnight-ntwrk/ledger-v6';
import type { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';

/**
 * Full WalletProvider implementation for seed wallets that can pay DUST fees directly.
 * Uses DustWallet.addFeePayment() for transaction fee balancing.
 */
export class SeedDustWalletProvider implements WalletProvider {
  #dustWallet: DustWallet;
  #dustSecretKey: DustSecretKey;
  #shieldedSecretKeys: ZswapSecretKeys;

  constructor(dustWallet: DustWallet, shieldedSecretKeys: ZswapSecretKeys, dustSecretKey: DustSecretKey) {
    this.#dustWallet = dustWallet;
    this.#shieldedSecretKeys = shieldedSecretKeys;
    this.#dustSecretKey = dustSecretKey;
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.#shieldedSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.#shieldedSecretKeys.encryptionPublicKey;
  }

  async balanceTx(
    tx: UnprovenTransaction,
    _newCoins?: ShieldedCoinInfo[],
    ttl?: Date
  ): Promise<ProvingRecipe<UnprovenTransaction | FinalizedTransaction>> {
    const now = new Date();
    const realTtl = ttl ?? new Date(now.getTime() + 5 * 60 * 1000);
    return this.#dustWallet.addFeePayment(this.#dustSecretKey, tx, realTtl, now);
  }

  async finalizeTx(recipe: ProvingRecipe<FinalizedTransaction>): Promise<FinalizedTransaction> {
    return this.#dustWallet.finalizeTransaction(recipe);
  }
}
