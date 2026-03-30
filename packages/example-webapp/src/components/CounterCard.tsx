import { AnimatedNumber } from './AnimatedNumber';

interface CounterCardProps {
  value: string | null;
  freeze?: boolean;
}

export function CounterCard({ value, freeze }: CounterCardProps) {
  if (value === null) return null;

  return (
    <div className="ces-inventory-card ces-inventory-left">
      <div className="text-[10px] uppercase tracking-widest text-ces-text-muted/60 mb-1">
        Contract State
      </div>
      <div className="text-xs text-ces-text-muted mb-3">Counter</div>
      <AnimatedNumber
        value={Number(value)}
        freeze={freeze}
        flash="green"
        duration={800}
        className="font-display font-bold text-4xl tabular-nums text-ces-text ces-counter-value"
      />
    </div>
  );
}
