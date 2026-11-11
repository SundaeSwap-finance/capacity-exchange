import type { CoinPublicKey, EncPublicKey, ZswapSecretKeys } from '@midnightntwrk/ledger-v9';
import {
  createLedger9WalletProvider,
  type FinalizedTx,
  type UnboundTx,
  type WalletProvider,
} from '@midnight-ntwrk/midnight-js/types';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk/facade';
import { toWalletTx } from './walletTx.js';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** A midnight-js WalletProvider that balances (including DUST fees) with a synced WalletFacade. */
export class DustWalletProvider implements WalletProvider {
  readonly #inner: WalletProvider;

  constructor(wallet: WalletFacade, zswap: ZswapSecretKeys) {
    this.#inner = createLedger9WalletProvider({
      getCoinPublicKey: () => zswap.coinPublicKey,
      getEncryptionPublicKey: () => zswap.encryptionPublicKey,
      async balanceTx(tx, ttl) {
        const recipe = await wallet.balanceUnboundTransaction(toWalletTx(wallet, 'Unbound', tx), {
          ttl: ttl ?? new Date(Date.now() + DEFAULT_TTL_MS),
        });
        return wallet.finalizeRecipe(recipe);
      },
    });
  }

  get supportedEras(): WalletProvider['supportedEras'] {
    return this.#inner.supportedEras;
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.#inner.getCoinPublicKey();
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.#inner.getEncryptionPublicKey();
  }

  balanceTx(tx: UnboundTx, ttl?: Date): Promise<FinalizedTx> {
    return this.#inner.balanceTx(tx, ttl);
  }
}
