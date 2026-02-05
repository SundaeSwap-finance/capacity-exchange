import type { ReactNode } from 'react';

type MessageVariant = 'error' | 'success' | 'info' | 'warn';

const variantStyles: Record<MessageVariant, { container: string; text: string }> = {
  error: {
    container: 'bg-red-900/20 border-red-700',
    text: 'text-red-400',
  },
  success: {
    container: 'bg-green-900/20 border-green-700',
    text: 'text-green-400',
  },
  info: {
    container: 'bg-blue-900/20 border-blue-700',
    text: 'text-blue-400',
  },
  warn: {
    container: 'bg-amber-900/20 border-amber-700',
    text: 'text-amber-200',
  },
};

interface MessageProps {
  variant: MessageVariant;
  children: ReactNode;
  className?: string;
}

export function Message({ variant, children, className = '' }: MessageProps) {
  const styles = variantStyles[variant];
  return (
    <div className={`p-3 border rounded ${styles.container} ${className}`}>
      <div className={`text-sm ${styles.text}`}>{children}</div>
    </div>
  );
}
