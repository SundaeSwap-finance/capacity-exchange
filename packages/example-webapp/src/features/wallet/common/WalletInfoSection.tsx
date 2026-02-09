import React from 'react';
import type { WalletData } from '../types';
import { Collapsible } from '../../../shared/ui';
import { AddressList } from './AddressList';
import { BalanceGrid } from './BalanceGrid';
import { ShieldedTokensList } from './ShieldedTokensList';

interface WalletInfoSectionProps {
  data: WalletData;
}

export function WalletInfoSection({ data }: WalletInfoSectionProps) {
  return (
    <div className="space-y-4">
      <BalanceGrid dustBalance={data.dustBalance} nightBalances={data.nightBalances} />
      <ShieldedTokensList balances={data.shieldedBalances} />
      <Collapsible title="Addresses" defaultOpen={false}>
        <AddressList
          unshieldedAddress={data.unshieldedAddress}
          shieldedAddress={data.shieldedAddress}
          dustAddress={data.dustAddress}
        />
      </Collapsible>
    </div>
  );
}
