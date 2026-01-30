import {
  CoinPublicKey,
  DustSecretKey,
  EncPublicKey,
  FinalizedTransaction,
  ShieldedCoinInfo,
  UnprovenTransaction,
  ZswapSecretKeys,
} from '@midnight-ntwrk/ledger-v6';
import { ProvingRecipe, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';

export class DustWalletProvider implements WalletProvider {
  #wallet: DustWallet;
  #zswapSecretKeys: ZswapSecretKeys;
  #dustSecretKey: DustSecretKey;

  constructor(wallet: DustWallet, zswap: ZswapSecretKeys, dust: DustSecretKey) {
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

  async balanceTx(
    tx: UnprovenTransaction,
    newCoins?: ShieldedCoinInfo[],
    ttl?: Date,
  ): Promise<ProvingRecipe<UnprovenTransaction | FinalizedTransaction>> {
    const now = new Date();
    const realTtl = ttl ?? new Date(now.getTime() + 5 * 1000 * 60);
    const balanced = await this.#wallet.addFeePayment(this.#dustSecretKey, tx, realTtl, now);
    return balanced;
  }
}
