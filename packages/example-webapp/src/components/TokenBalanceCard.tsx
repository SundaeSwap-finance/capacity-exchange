import { AnimatedNumber } from './AnimatedNumber';

interface TokenBalanceCardProps {
  balance: bigint;
  tokenLabel?: string;
  freeze?: boolean;
}

export function TokenBalanceCard({ balance, tokenLabel = 'Tokens', freeze }: TokenBalanceCardProps) {
  return (
    <div className="ces-inventory-card ces-inventory-right">
      <div className="text-[10px] uppercase tracking-widest text-ces-text-muted/60 mb-1">
        Wallet
      </div>
      <div className="text-xs text-ces-text-muted mb-3">{tokenLabel}</div>
      <AnimatedNumber
        value={Number(balance)}
        freeze={freeze}
        flash="red"
        duration={800}
        className="font-display font-bold text-4xl tabular-nums text-ces-gold ces-balance-value"
      />
    </div>
  );
}
