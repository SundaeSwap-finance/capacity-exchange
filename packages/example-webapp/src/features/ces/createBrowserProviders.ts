import type { WalletProvider, ProofProvider, MidnightProvider, ProvingRecipe } from '@midnight-ntwrk/midnight-js-types';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type {
  CoinPublicKey,
  EncPublicKey,
  FinalizedTransaction,
  ShieldedCoinInfo,
  UnprovenTransaction,
  ZswapSecretKeys,
  DustSecretKey,
  SignatureEnabled,
  Proof,
  Binding,
} from '@midnight-ntwrk/ledger-v6';
import { Transaction } from '@midnight-ntwrk/ledger-v6';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { Config } from '../../config';

export interface BrowserProviders {
  walletProvider: WalletProvider;
  connectedAPI: ConnectedAPI;
  proofProvider: ProofProvider<string>;
  midnightProvider: MidnightProvider;
}

export interface ShieldedAddressInfo {
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
}

function hexToUint8Array(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/, '');
  const matches = cleaned.match(/.{1,2}/g);
  if (!matches) return new Uint8Array();
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Creates a ConnectedAPI adapter for seed wallets.
 * This adapter implements the subset of ConnectedAPI needed for CES flow.
 */
function createSeedWalletConnectedAPIAdapter(
  walletFacade: WalletFacade,
  shieldedSecretKeys: ZswapSecretKeys,
  dustSecretKey: DustSecretKey,
  shieldedAddress: ShieldedAddressInfo,
  unshieldedAddress: string,
  dustAddress: string,
  config: Config
): ConnectedAPI {
  return {
    async getShieldedBalances() {
      const state = await walletFacade.shielded.waitForSyncedState();
      return state.balances;
    },

    async getUnshieldedBalances() {
      const state = await walletFacade.unshielded.waitForSyncedState();
      return state.balances;
    },

    async getDustBalance() {
      const state = await walletFacade.dust.waitForSyncedState();
      const balance = state.walletBalance(new Date());
      return { balance, cap: 0n };
    },

    async getShieldedAddresses() {
      return shieldedAddress;
    },

    async getUnshieldedAddress() {
      return { unshieldedAddress };
    },

    async getDustAddress() {
      return { dustAddress };
    },

    async getTxHistory() {
      return [];
    },

    async balanceUnsealedTransaction(_tx: string) {
      throw new Error('balanceUnsealedTransaction not implemented for seed wallet');
    },

    async balanceSealedTransaction(txHex: string) {
      console.log('[SeedWalletAdapter] ========== balanceSealedTransaction called ==========');
      console.log('[SeedWalletAdapter] Using coin public key:', shieldedSecretKeys.coinPublicKey.slice(0, 16) + '...');
      console.log('[SeedWalletAdapter] Input tx hex length:', txHex.length);

      // Deserialize the transaction
      const txBytes = hexToUint8Array(txHex);
      const tx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
        'signature',
        'proof',
        'binding',
        txBytes
      ).bind();

      console.log('[SeedWalletAdapter] Transaction deserialized');
      console.log('[SeedWalletAdapter] Tx identifiers:', tx.identifiers());
      console.log('[SeedWalletAdapter] Tx hash:', tx.transactionHash());

      // Check imbalances before balancing
      const requiredTokenTypes: string[] = [];
      try {
        const imbalances0 = tx.imbalances(0);
        console.log('[SeedWalletAdapter] Imbalances BEFORE balancing (segment 0):');
        imbalances0.forEach((value, key) => {
          const keyStr = typeof key === 'string' ? key : JSON.stringify(key);
          console.log(`  ${keyStr}: ${value.toString()}`);
          if (value < 0n) {
            requiredTokenTypes.push(keyStr);
            console.log(`  ^ This token type needs to be covered (negative = deficit)`);
          }
        });
      } catch (e) {
        console.log('[SeedWalletAdapter] Could not get imbalances for segment 0:', e);
      }
      try {
        const imbalances1 = tx.imbalances(1);
        console.log('[SeedWalletAdapter] Imbalances BEFORE balancing (segment 1):');
        imbalances1.forEach((value, key) => {
          const keyStr = typeof key === 'string' ? key : JSON.stringify(key);
          console.log(`  ${keyStr}: ${value.toString()}`);
          if (value < 0n) {
            requiredTokenTypes.push(keyStr);
            console.log(`  ^ This token type needs to be covered (negative = deficit)`);
          }
        });
      } catch (e) {
        console.log('[SeedWalletAdapter] Could not get imbalances for segment 1:', e);
      }

      // Log the wallet's current shielded token balances and coin details
      const shieldedState = await walletFacade.shielded.waitForSyncedState();
      console.log('[SeedWalletAdapter] Shielded address:', shieldedState.address?.coinPublicKeyString?.() ?? 'N/A');
      console.log('[SeedWalletAdapter] Current shielded token balances:');
      const availableTokenTypes: string[] = [];
      for (const [tokenType, balance] of Object.entries(shieldedState.balances)) {
        console.log(`  ${tokenType}: ${balance}`);
        if (BigInt(balance) > 0n) {
          availableTokenTypes.push(tokenType);
        }
      }

      // Compare required vs available
      console.log('[SeedWalletAdapter] === Token Type Comparison ===');
      console.log('[SeedWalletAdapter] Required token types (from tx imbalances):', requiredTokenTypes);
      console.log('[SeedWalletAdapter] Available token types (wallet has balance):', availableTokenTypes);
      for (const required of requiredTokenTypes) {
        const hasMatch = availableTokenTypes.some(avail => avail === required || avail.includes(required) || required.includes(avail));
        if (!hasMatch) {
          console.log(`[SeedWalletAdapter] *** MISSING: Wallet does NOT have token type: ${required}`);
        } else {
          console.log(`[SeedWalletAdapter] OK: Wallet has token type: ${required}`);
        }
      }

      console.log('[SeedWalletAdapter] Available coins:', shieldedState.availableCoins?.length ?? 'N/A');
      console.log('[SeedWalletAdapter] Pending coins:', shieldedState.pendingCoins?.length ?? 'N/A');
      console.log('[SeedWalletAdapter] Total coins:', shieldedState.totalCoins?.length ?? 'N/A');
      if (shieldedState.availableCoins && shieldedState.availableCoins.length > 0) {
        console.log('[SeedWalletAdapter] Available coin details:');
        shieldedState.availableCoins.forEach((coin, i) => {
          console.log(`  [${i}]`, coin);
        });
      }
      if (shieldedState.pendingCoins && shieldedState.pendingCoins.length > 0) {
        console.log('[SeedWalletAdapter] Pending coin details:');
        shieldedState.pendingCoins.forEach((coin, i) => {
          console.log(`  [${i}]`, coin);
        });
      }
      console.log('[SeedWalletAdapter] Wallet sync progress:', shieldedState.progress);

      // Use the shielded wallet to balance the transaction
      // This will add the user's shielded token inputs to cover any deficit
      console.log('[SeedWalletAdapter] Calling shielded wallet balanceTransaction...');
      try {
        const shieldedWallet = walletFacade.shielded;
        const recipe = await shieldedWallet.balanceTransaction(shieldedSecretKeys, tx, []);
        console.log('[SeedWalletAdapter] Balance transaction returned recipe');

        // Finalize the transaction
        console.log('[SeedWalletAdapter] Finalizing transaction...');
        const dustWallet = walletFacade.dust as DustWallet;
        const finalized = await dustWallet.finalizeTransaction(recipe);
        console.log('[SeedWalletAdapter] Transaction finalized');
        console.log('[SeedWalletAdapter] Finalized tx identifiers:', finalized.identifiers());

        // Check imbalances after balancing
        try {
          const imbalancesAfter = finalized.imbalances(0);
          console.log('[SeedWalletAdapter] Imbalances AFTER balancing (segment 0):');
          imbalancesAfter.forEach((value, key) => {
            console.log(`  ${JSON.stringify(key)}: ${value.toString()}`);
          });
        } catch (e) {
          console.log('[SeedWalletAdapter] Could not get imbalances after balancing:', e);
        }

        // Serialize and return
        const serialized = finalized.serialize();
        const serializedHex = uint8ArrayToHex(serialized);
        console.log('[SeedWalletAdapter] Returning balanced tx, length:', serializedHex.length);
        return { tx: serializedHex };
      } catch (e) {
        console.error('[SeedWalletAdapter] Balance transaction failed:', e);
        throw e;
      }
    },

    async makeTransfer() {
      throw new Error('makeTransfer not implemented for seed wallet');
    },

    async makeIntent() {
      throw new Error('makeIntent not implemented for seed wallet');
    },

    async signData() {
      throw new Error('signData not implemented for seed wallet');
    },

    async submitTransaction(txHex: string) {
      console.debug('[SeedWalletAdapter] ========== submitTransaction called ==========');
      console.debug('[SeedWalletAdapter] Tx hex length:', txHex.length);
      const txBytes = hexToUint8Array(txHex);
      console.debug('[SeedWalletAdapter] Tx bytes length:', txBytes.length);

      console.debug('[SeedWalletAdapter] Deserializing transaction...');
      const tx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
        'signature',
        'proof',
        'binding',
        txBytes
      ).bind();

      console.debug('[SeedWalletAdapter] Transaction deserialized');
      console.debug('[SeedWalletAdapter] Tx identifiers:', tx.identifiers());
      console.debug('[SeedWalletAdapter] Tx hash:', tx.transactionHash());

      console.debug('[SeedWalletAdapter] Submitting to walletFacade...');
      try {
        await walletFacade.submitTransaction(tx as unknown as FinalizedTransaction);
        console.debug('[SeedWalletAdapter] Transaction submitted successfully');
      } catch (error) {
        console.error('[SeedWalletAdapter] Transaction submission failed:', error);
        throw error;
      }
    },

    async getProvingProvider() {
      throw new Error('getProvingProvider not implemented for seed wallet');
    },

    async getConfiguration() {
      return {
        indexerUri: config.indexerUrl,
        indexerWsUri: config.indexerWsUrl,
        proverServerUri: config.proofServerUrl,
        substrateNodeUri: config.nodeWsUrl,
        networkId: config.networkId,
      };
    },

    async getConnectionStatus() {
      return { status: 'connected' as const, networkId: config.networkId };
    },

    async hintUsage() {
      // No-op for seed wallet
    },
  };
}

/**
 * Creates a WalletProvider from shielded address info.
 * This is a minimal provider that only provides public keys.
 * For extension wallets, balanceTx is not supported directly - use CES flow instead.
 */
function createMinimalWalletProvider(shieldedAddress: ShieldedAddressInfo): WalletProvider {
  return {
    getCoinPublicKey(): CoinPublicKey {
      return shieldedAddress.shieldedCoinPublicKey as CoinPublicKey;
    },

    getEncryptionPublicKey(): EncPublicKey {
      return shieldedAddress.shieldedEncryptionPublicKey as EncPublicKey;
    },

    async balanceTx(
      _tx: UnprovenTransaction,
      _newCoins?: ShieldedCoinInfo[],
      _ttl?: Date
    ) {
      throw new Error('balanceTx should be handled by capacityExchangeWalletProvider');
    },
  };
}

/**
 * Full WalletProvider implementation for seed wallets that can pay DUST fees directly.
 * Uses DustWallet.addFeePayment() for transaction fee balancing.
 */
class SeedDustWalletProvider implements WalletProvider {
  #dustWallet: DustWallet;
  #dustSecretKey: DustSecretKey;
  #shieldedSecretKeys: ZswapSecretKeys;

  constructor(
    dustWallet: DustWallet,
    shieldedSecretKeys: ZswapSecretKeys,
    dustSecretKey: DustSecretKey
  ) {
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
    console.debug('[SeedDustWalletProvider] balanceTx called, adding fee payment...');
    const balanced = await this.#dustWallet.addFeePayment(this.#dustSecretKey, tx, realTtl, now);
    console.debug('[SeedDustWalletProvider] Fee payment added successfully');
    return balanced;
  }

  async finalizeTx(recipe: ProvingRecipe<FinalizedTransaction>): Promise<FinalizedTransaction> {
    console.debug('[SeedDustWalletProvider] finalizeTx called');
    const finalized = await this.#dustWallet.finalizeTransaction(recipe);
    console.debug('[SeedDustWalletProvider] Transaction finalized');
    return finalized;
  }
}

/**
 * Creates a MidnightProvider that uses the ConnectedAPI for transaction submission.
 */
function createMidnightProviderFromConnectedAPI(connectedAPI: ConnectedAPI): MidnightProvider {
  return {
    async submitTx(tx: FinalizedTransaction): Promise<string> {
      console.debug('[MidnightProvider] ========== submitTx called ==========');
      const serialized = tx.serialize();
      const serializedStr = uint8ArrayToHex(serialized);
      console.debug('[MidnightProvider] Serialized tx length:', serializedStr.length);
      console.debug('[MidnightProvider] Tx identifiers:', tx.identifiers());
      console.debug('[MidnightProvider] Tx hash:', tx.transactionHash());

      console.debug('[MidnightProvider] Calling connectedAPI.submitTransaction...');
      try {
        await connectedAPI.submitTransaction(serializedStr);
        console.debug('[MidnightProvider] Transaction submitted successfully');
      } catch (error) {
        console.error('[MidnightProvider] Transaction submission failed:', error);
        throw error;
      }

      const txId = tx.identifiers()[0];
      console.debug('[MidnightProvider] Returning txId:', txId);
      return txId;
    },
  };
}

export interface SeedWalletInfo {
  walletFacade: WalletFacade;
  shieldedSecretKeys: ZswapSecretKeys;
  dustSecretKey: DustSecretKey;
  shieldedAddress: ShieldedAddressInfo;
  unshieldedAddress: string;
  dustAddress: string;
}

/**
 * Creates browser providers from a seed wallet connection.
 * The wallet provider uses direct DUST payment via DustWallet.addFeePayment().
 */
export function createProvidersFromSeedWallet(
  seedWalletInfo: SeedWalletInfo,
  config: Config
): BrowserProviders {
  const {
    walletFacade,
    shieldedSecretKeys,
    dustSecretKey,
    shieldedAddress,
    unshieldedAddress,
    dustAddress,
  } = seedWalletInfo;

  const connectedAPI = createSeedWalletConnectedAPIAdapter(
    walletFacade,
    shieldedSecretKeys,
    dustSecretKey,
    shieldedAddress,
    unshieldedAddress,
    dustAddress,
    config
  );

  // Use the full DustWalletProvider that can pay DUST fees directly
  const dustWallet = walletFacade.dust as DustWallet;
  const walletProvider = new SeedDustWalletProvider(dustWallet, shieldedSecretKeys, dustSecretKey);
  const proofProvider = httpClientProofProvider(config.proofServerUrl);
  const midnightProvider = createMidnightProviderFromConnectedAPI(connectedAPI);

  return {
    walletProvider,
    connectedAPI,
    proofProvider,
    midnightProvider,
  };
}

/**
 * Creates browser providers from an extension wallet connection.
 */
export function createProvidersFromExtensionWallet(
  connectedAPI: ConnectedAPI,
  shieldedAddress: ShieldedAddressInfo,
  config: Config
): BrowserProviders {
  const walletProvider = createMinimalWalletProvider(shieldedAddress);
  const proofProvider = httpClientProofProvider(config.proofServerUrl);
  const midnightProvider = createMidnightProviderFromConnectedAPI(connectedAPI);

  return {
    walletProvider,
    connectedAPI,
    proofProvider,
    midnightProvider,
  };
}
