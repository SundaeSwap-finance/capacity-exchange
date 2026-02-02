import React from 'react';
import type { WalletData } from '../types';
import { Collapsible, InfoRow } from '../../../shared/ui';
import { BalanceBox } from './BalanceBox';
import { TokenBalanceLookup } from './TokenBalanceLookup';
import { formatDust, formatNight } from '../../../utils/format';

interface WalletInfoSectionProps {
  data: WalletData;
  onRefresh: () => void;
}

export function WalletInfoSection({ data, onRefresh }: WalletInfoSectionProps) {
  return (
    <Collapsible title="Wallet Info" defaultOpen>
      <div className="space-y-4">
        <div className="space-y-2 text-sm">
          <InfoRow label="Unshielded Address" value={data.unshieldedAddress} />
          <InfoRow label="Shielded Address" value={data.shieldedAddress} />
          <InfoRow label="Dust Address" value={data.dustAddress} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <BalanceBox label="DUST Balance" value={formatDust(data.dustBalance)} />
          <BalanceBox label="DUST Cap" value={formatDust(data.dustCap)} />
          <BalanceBox
            label="NIGHT Balance"
            value={
              Object.values(data.nightBalances)
                .map((b) => formatNight(b))
                .join(', ') || '-'
            }
          />
        </div>

        <TokenBalanceLookup shieldedBalances={data.shieldedBalances} onRefresh={onRefresh} />
      </div>
    </Collapsible>
  );
}
