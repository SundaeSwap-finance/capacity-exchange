import React from 'react';

type SpinnerSize = 'sm' | 'md';

const sizeStyles: Record<SpinnerSize, string> = {
  sm: 'h-2 w-2 border',
  md: 'h-4 w-4 border-2',
};

interface LoadingSpinnerProps {
  message: string;
  size?: SpinnerSize;
}

export function LoadingSpinner({ message, size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center gap-2 text-dark-400 text-sm">
      <div className={`animate-spin ${sizeStyles[size]} border-dark-400 border-t-transparent rounded-full`} />
      {message}
    </div>
  );
}
