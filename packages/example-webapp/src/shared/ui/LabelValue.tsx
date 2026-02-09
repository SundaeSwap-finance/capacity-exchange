import type { ReactNode } from 'react';

interface LabelValueProps {
  label: ReactNode;
  children: ReactNode;
  layout?: 'inline' | 'stacked';
}

export function LabelValue({ label, children, layout = 'stacked' }: LabelValueProps) {
  if (layout === 'inline') {
    return (
      <div>
        <span className="text-dark-400">{label}:</span>{' '}
        <span className="font-mono text-dark-300 break-all">{children}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs text-dark-400">{label}</div>
      <div className="text-white font-mono break-all">{children}</div>
    </div>
  );
}
