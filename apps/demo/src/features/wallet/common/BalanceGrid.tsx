import React from 'react';
import { getNightBalance, starsToNight } from '@sundaeswap/capacity-exchange-core';
import { LabelValue } from '../../../shared/ui';
import { formatDust } from '../../../utils/format';

interface BalanceGridProps {
  dustBalance: bigint;
  unshieldedBalances: Record<string, bigint>;
}

export function BalanceGrid({ dustBalance, unshieldedBalances }: BalanceGridProps) {
  const nightDisplay = starsToNight(getNightBalance(unshieldedBalances)) || '-';

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-dark-800 px-3 py-2 rounded">
        <LabelValue label="DUST">{formatDust(dustBalance)}</LabelValue>
      </div>
      <div className="bg-dark-800 px-3 py-2 rounded">
        <LabelValue label="NIGHT">{nightDisplay}</LabelValue>
      </div>
    </div>
  );
}
