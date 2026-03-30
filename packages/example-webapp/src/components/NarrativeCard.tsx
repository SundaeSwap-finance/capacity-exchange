import type { ReactNode } from 'react';

interface NarrativeCardProps {
  heading: string;
  children: ReactNode;
  variant?: 'default' | 'accent' | 'gold';
  action?: ReactNode;
}

export function NarrativeCard({ heading, children, variant = 'default', action }: NarrativeCardProps) {
  const boxClass = variant === 'accent' ? 'ces-highlight-box' : variant === 'gold' ? 'ces-gold-box' : 'ces-card';

  return (
    <div className={boxClass}>
      <h2 className="ces-heading text-xl mb-3">{heading}</h2>
      <div className="text-ces-text-muted text-sm leading-relaxed space-y-3">{children}</div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
