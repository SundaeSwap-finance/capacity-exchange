import React from 'react';
import { BalanceBox } from './BalanceBox';
import { formatDust, formatNight } from '../../../utils/format';

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
      <BalanceBox label="DUST" value={formatDust(dustBalance)} />
      <BalanceBox label="NIGHT" value={nightDisplay} />
    </div>
  );
}
