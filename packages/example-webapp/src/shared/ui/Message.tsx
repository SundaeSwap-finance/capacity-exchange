import type { ReactNode } from 'react';

type MessageVariant = 'error' | 'success' | 'info' | 'warn';

const variantStyles: Record<MessageVariant, { container: string; text: string; icon: string }> = {
  error: {
    container: 'bg-red-900/20 border-red-700/50',
    text: 'text-red-300',
    icon: '❌',
  },
  success: {
    container: 'bg-green-900/20 border-green-700/50',
    text: 'text-green-300',
    icon: '✅',
  },
  info: {
    container: 'bg-blue-900/20 border-blue-700/50',
    text: 'text-blue-300',
    icon: 'ℹ️',
  },
  warn: {
    container: 'bg-amber-900/20 border-amber-700/50',
    text: 'text-amber-300',
    icon: '⚠️',
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
      <div className={`flex gap-2 text-sm ${styles.text}`}>
        <span>{styles.icon}</span>
        <div>{children}</div>
      </div>
    </div>
  );
}
