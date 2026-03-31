import { AnimatedNumber } from './AnimatedNumber';

interface TokenBalanceCardProps {
  balance: bigint;
  tokenLabel?: string;
  centered?: boolean;
}

export function TokenBalanceCard({ balance, tokenLabel = 'Tutorial Tokens', centered }: TokenBalanceCardProps) {
  return (
    <div className={`ces-inventory-card ${centered ? 'ces-inventory-center' : 'ces-inventory-right'}`}>
      <div className="mb-1 text-[10px] uppercase tracking-widest text-ces-text-muted/60">Wallet</div>
      <div className="mb-2 text-xs text-ces-text-muted">{tokenLabel}</div>
      <AnimatedNumber
        value={Number(balance)}
        flash="auto"
        duration={800}
        className="font-display font-bold text-4xl tabular-nums text-ces-gold ces-balance-value"
      />
    </div>
  );
}
