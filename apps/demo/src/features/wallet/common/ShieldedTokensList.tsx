import React from 'react';
import { truncateMiddle } from '../../../utils/format';

interface ShieldedTokensListProps {
  balances: Record<string, bigint>;
}

export function ShieldedTokensList({ balances }: ShieldedTokensListProps) {
  const entries = Object.entries(balances).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm">Shielded Tokens</span>
      <div className="space-y-1">
        {entries.map(([tokenType, balance]) => (
          <div key={tokenType} className="flex justify-between items-center rounded-sm px-3 py-2">
            <span className="font-mono text-xs" title={tokenType}>
              {tokenType ? truncateMiddle(tokenType) : 'NIGHT'}
            </span>
            <span className="text-sm">{balance.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
