import { formatDust } from '../utils/format';

interface BalanceDisplayProps {
  dustBalance: bigint;
  shieldedBalances?: Record<string, bigint>;
  highlightEmpty?: boolean;
  tokenLabel?: string;
}

export function BalanceDisplay({ dustBalance, shieldedBalances, highlightEmpty, tokenLabel }: BalanceDisplayProps) {
  const isEmpty = dustBalance === 0n;
  const hasTokens = shieldedBalances && Object.values(shieldedBalances).some((b) => b > 0n);

  return (
    <div className="space-y-3">
      <div
        className={`flex items-center justify-between p-3 rounded-lg border ${
          isEmpty && highlightEmpty
            ? 'border-ces-danger/30 bg-ces-danger/5'
            : 'border-ces-border bg-ces-surface-raised/50'
        }`}
      >
        <span className="text-sm text-ces-text-muted">DUST Balance</span>
        <span
          className={`font-display font-semibold ${isEmpty && highlightEmpty ? 'text-ces-danger' : 'text-ces-text'}`}
        >
          {isEmpty ? '0' : formatDust(dustBalance)}
        </span>
      </div>

      {shieldedBalances && hasTokens && (
        <div className="space-y-2">
          {Object.entries(shieldedBalances)
            .filter(([, balance]) => balance > 0n)
            .map(([color, balance]) => (
              <div
                key={color}
                className="flex items-center justify-between p-3 rounded-lg border border-ces-border bg-ces-surface-raised/50"
              >
                <span className="text-sm text-ces-text-muted">{tokenLabel ?? truncateColor(color)}</span>
                <span className="font-display font-semibold text-ces-gold">{balance.toString()}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function truncateColor(color: string): string {
  if (color.length <= 12) {
    return color;
  }
  return `${color.slice(0, 6)}...${color.slice(-4)}`;
}
