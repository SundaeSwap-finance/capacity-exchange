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
    <Collapsible title="Wallet Info" defaultOpen>
      <div className="space-y-4">
        <AddressList
          unshieldedAddress={data.unshieldedAddress}
          shieldedAddress={data.shieldedAddress}
          dustAddress={data.dustAddress}
        />
        <BalanceGrid dustBalance={data.dustBalance} nightBalances={data.nightBalances} />
        <ShieldedTokensList balances={data.shieldedBalances} />
      </div>
    </Collapsible>
  );
}
