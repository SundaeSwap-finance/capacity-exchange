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
      <h2 className="ces-heading mb-2.5 text-2xl">{heading}</h2>
      <div className="ces-section-stack text-sm leading-relaxed text-ces-text-muted">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
