import { useMemo } from 'react';
import { parseCoinPublicKey } from '@capacity-exchange/midnight-core';

export function useCoinPublicKey(shieldedAddress: string | undefined): string | undefined {
  return useMemo(() => {
    if (!shieldedAddress) {
      return undefined;
    }
    const parsed = parseCoinPublicKey(shieldedAddress);
    if (!parsed.ok) {
      throw new Error(`Invalid Midnight address from wallet: ${parsed.error}`);
    }
    return parsed.coinPublicKey;
  }, [shieldedAddress]);
}
