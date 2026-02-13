import React from 'react';
import { LabelValue } from '../../../shared/ui';
import { formatNight } from '../../../utils/format';

interface BalanceGridProps {
  dustBalance: bigint;
  nightBalances: Record<string, bigint>;
}

export function BalanceGrid({ dustBalance, nightBalances }: BalanceGridProps) {
  const nightDisplay =
    Object.values(nightBalances)
      .map((b) => formatNight(b))
      .join(', ') || '-';

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-dark-800 px-3 py-2 rounded">
        <LabelValue label="specks">{dustBalance.toLocaleString()}</LabelValue>
      </div>
      <div className="bg-dark-800 px-3 py-2 rounded">
        <LabelValue label="NIGHT">{nightDisplay}</LabelValue>
      </div>
    </div>
  );
}
