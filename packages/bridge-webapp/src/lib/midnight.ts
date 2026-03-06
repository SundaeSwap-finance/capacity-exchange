import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { requireBrowserEnv, connectMidnightExtension, encodeShieldedAddress } from '@capacity-exchange/midnight-core';

export interface MidnightDisplayInfo {
  shieldedAddress: string;
  nightBalance: bigint;
}

export async function deriveMidnightDisplay(wallet: ConnectedAPI): Promise<MidnightDisplayInfo> {
  const networkId = requireBrowserEnv('VITE_NETWORK_ID');
  const raw = await wallet.getShieldedAddresses();
  const encoded = encodeShieldedAddress(networkId, raw.shieldedCoinPublicKey, raw.shieldedEncryptionPublicKey);
  if (!encoded.ok) {
    throw new Error(encoded.error);
  }
  const unshielded = await wallet.getUnshieldedBalances();
  const nightBalance = Object.values(unshielded).reduce((sum, v) => sum + v, 0n);
  return { shieldedAddress: encoded.address, nightBalance };
}

export async function connectMidnightWallet(): Promise<ConnectedAPI> {
  const networkId = requireBrowserEnv('VITE_NETWORK_ID');
  const result = await connectMidnightExtension(networkId);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.wallet;
}
