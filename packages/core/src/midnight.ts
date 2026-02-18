import { MidnightBech32m, ShieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';

export function parseCoinPublicKey(shieldedMidnightAddress: string): string {
  const parsed = MidnightBech32m.parse(shieldedMidnightAddress);
  const shieldedAddress = parsed.decode(ShieldedAddress, parsed.network);
  return shieldedAddress.coinPublicKey.toHexString();
}
