import { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useMemo } from 'react';
import { MOCK_PRICE_1 } from './constants';

export function useMockWallet(): ConnectedAPI {
  return useMemo(() => {
    return {
      async getShieldedBalances() {
        return {
          [MOCK_PRICE_1.currency.rawId]: 10_000_000n,
        };
      },
      async getUnshieldedBalances() {
        return {};
      },
      async getDustBalance() {
        return {
          cap: 0n,
          balance: 0n,
        };
      },
      async getShieldedAddresses() {
        return {
          shieldedAddress:
            'mn_shield-addr_preview13mzsthsg8jkxuwuj980w2rjfc2hm2kmwxk928r47nnpjlvu5msspklrhxnmxrk6xa0ykh2psrpv24k3v9dwtu2rff98f3vdz8qpcvjsysanxu',
          shieldedCoinPublicKey: '8ec505de083cac6e3b9229dee50e49c2afb55b6e358aa38ebe9cc32fb394dc20',
          shieldedEncryptionPublicKey: '1b7c7734f661db46ebc96ba8301858aada2c2b5cbe2869494e98b1a23803864a',
        };
      },
      async getUnshieldedAddress() {
        return {
          unshieldedAddress: 'mn_addr_preview17zdtmx3yl4ed8qzwuwglf8435retucpqga2xqant79wgh9c8dcsq7anf8v',
        };
      },
      async getDustAddress() {
        return {
          dustAddress:
            'mn_dust-addr_preview1qe8qj25qkva7ug6qf3rvl3y0a366ydt2nvq30rwk5ckznavfdansxqqx83m48p22agv25y0sf4mm83l25zgcuj4f34027pcymr6v9lp89zv7lwu2wyn472s6ahfflpusy8sfv268xrumgls6lh0llz',
        };
      },
      async getTxHistory() {
        return [];
      },
      async balanceUnsealedTransaction(tx: string) {
        return { tx };
      },
      async balanceSealedTransaction(tx: string) {
        return { tx };
      },
      async makeTransfer() {
        throw new Error('makeTransfer not implemented');
      },
      async makeIntent() {
        throw new Error('makeIntent not implemented');
      },
      async signData() {
        throw new Error('signData not implemented');
      },
      async submitTransaction(tx) {
        console.log('Transaction submitted!', { tx });
      },
      async getProvingProvider(kmp) {
        return {
          async check() {
            return [];
          },
          async prove(tx) {
            return tx;
          },
        };
      },
      async getConfiguration() {
        return {
          indexerUri: 'http://localhost:8088',
          indexerWsUri: 'ws://localhost:8088',
          substrateNodeUri: 'http://localhost:9001',
          networkId: 'preview',
        };
      },
      async getConnectionStatus() {
        return {
          status: 'connected',
          networkId: 'preview',
        };
      },
      async hintUsage() {},
    };
  }, []);
}
