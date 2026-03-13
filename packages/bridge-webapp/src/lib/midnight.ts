import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { requireBrowserEnv, connectMidnightExtension, encodeShieldedAddress } from '@capacity-exchange/midnight-core';

export async function deriveShieldedAddress(wallet: ConnectedAPI): Promise<string> {
  const networkId = requireBrowserEnv('VITE_NETWORK_ID');
  const raw = await wallet.getShieldedAddresses();
  const encoded = encodeShieldedAddress(networkId, raw.shieldedCoinPublicKey, raw.shieldedEncryptionPublicKey);
  if (!encoded.ok) {
    throw new Error(encoded.error);
  }
  return encoded.address;
}

export async function connectMidnightWallet(): Promise<ConnectedAPI> {
  const networkId = requireBrowserEnv('VITE_NETWORK_ID');
  const result = await connectMidnightExtension(networkId);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.wallet;
}
