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
      <span className="text-dark-500 text-sm">Shielded Tokens</span>
      <div className="space-y-1">
        {entries.map(([tokenType, balance]) => (
          <div key={tokenType} className="flex justify-between items-center bg-dark-800 rounded px-3 py-2">
            <span className="font-mono text-xs text-dark-400" title={tokenType}>
              {tokenType ? truncateMiddle(tokenType) : 'NIGHT'}
            </span>
            <span className="text-dark-200 text-sm">{balance.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
