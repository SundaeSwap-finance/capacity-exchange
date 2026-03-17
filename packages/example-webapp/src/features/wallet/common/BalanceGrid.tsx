import React from 'react';
import { getNightBalance, specksToNight } from '@capacity-exchange/midnight-core';
import { LabelValue } from '../../../shared/ui';
import { formatDust } from '../../../utils/format';

interface BalanceGridProps {
  dustBalance: bigint;
  nightBalances: Record<string, bigint>;
}

export function BalanceGrid({ dustBalance, nightBalances }: BalanceGridProps) {
  const nightDisplay = specksToNight(getNightBalance(nightBalances)) || '-';

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
