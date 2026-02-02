import React, { useState, useEffect, useRef } from 'react';

interface TokenBalanceLookupProps {
  shieldedBalances: Record<string, bigint>;
  onRefresh: () => void;
}

export function TokenBalanceLookup({ shieldedBalances, onRefresh }: TokenBalanceLookupProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [flashingTokens, setFlashingTokens] = useState<Set<string>>(new Set());
  const prevBalancesRef = useRef<Record<string, bigint>>({});
  const balanceEntries = Object.entries(shieldedBalances);
  const hasBalances = balanceEntries.length > 0;

  // Detect changes and trigger flash
  useEffect(() => {
    const prevBalances = prevBalancesRef.current;
    const changedTokens = new Set<string>();

    for (const [token, balance] of Object.entries(shieldedBalances)) {
      const prevBalance = prevBalances[token];
      if (prevBalance !== undefined && prevBalance !== balance) {
        changedTokens.add(token);
      }
    }

    if (changedTokens.size > 0) {
      setFlashingTokens(changedTokens);
      // Clear flash after animation
      const timeout = setTimeout(() => setFlashingTokens(new Set()), 1500);
      return () => clearTimeout(timeout);
    }

    prevBalancesRef.current = { ...shieldedBalances };
  }, [shieldedBalances]);

  // Update prev ref when balances change
  useEffect(() => {
    prevBalancesRef.current = { ...shieldedBalances };
  }, [shieldedBalances]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="bg-dark-800 rounded border border-dark-600 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-400">Shielded Token Balances</span>
          {hasBalances && (
            <span className="text-xs text-dark-500">({balanceEntries.length})</span>
          )}
          <span className="text-xs text-dark-600">auto-updates</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:text-dark-500 flex items-center gap-1"
        >
          <svg
            className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {hasBalances ? (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {balanceEntries.map(([token, bal]) => {
            const isFlashing = flashingTokens.has(token);
            return (
              <div
                key={token}
                className={`flex justify-between text-xs px-1 py-0.5 rounded transition-colors duration-300 ${
                  isFlashing ? 'bg-yellow-500/30 animate-pulse' : 'bg-dark-900'
                }`}
              >
                <span className="font-mono text-dark-400 truncate max-w-[200px]" title={token}>
                  {token}
                </span>
                <span
                  className={`font-mono ml-2 transition-colors duration-300 ${
                    isFlashing ? 'text-yellow-300 font-bold' : 'text-dark-200'
                  }`}
                >
                  {bal.toString()}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-dark-500">No shielded token balances</div>
      )}
    </div>
  );
}
