import { AnimatedNumber } from './AnimatedNumber';

interface CounterCardProps {
  value: string | null;
  freeze?: boolean;
  eyebrow?: string;
  label?: string;
}

export function CounterCard({
  value,
  freeze,
  eyebrow = 'Underlying Contract State',
  label = 'Registered Graduations',
}: CounterCardProps) {
  if (value === null) {
    return null;
  }

  return (
    <div className="ces-inventory-card ces-inventory-left">
      <div className="mb-1 text-[10px] uppercase tracking-widest text-ces-text-muted/60">{eyebrow}</div>
      <div className="mb-2 text-xs text-ces-text-muted">{label}</div>
      <AnimatedNumber
        value={Number(value)}
        freeze={freeze}
        flash="auto"
        duration={800}
        className="font-display font-bold text-4xl tabular-nums text-ces-text ces-counter-value"
      />
    </div>
  );
}
