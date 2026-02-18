import type { CardanoNetwork } from '@capacity-exchange/core';
import { getCardanoNetwork } from '../lib/blockfrost';

const NETWORK: CardanoNetwork = getCardanoNetwork();

const NETWORK_COLORS: Record<CardanoNetwork, string> = {
  mainnet: 'bg-red-600',
  preprod: 'bg-amber-600',
  preview: 'bg-violet-600',
};

export function NetworkRibbon() {
  if (NETWORK === 'mainnet') { return null; }

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className={`${NETWORK_COLORS[NETWORK]} ribbon`}>
        {NETWORK} network
      </div>
    </div>
  );
}
