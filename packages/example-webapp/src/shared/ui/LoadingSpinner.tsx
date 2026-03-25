import React, { useState, useEffect, useRef } from 'react';
import { formatElapsed } from '@capacity-exchange/midnight-core';

type SpinnerSize = 'sm' | 'md';

const sizeStyles: Record<SpinnerSize, string> = {
  sm: 'h-2 w-2 border',
  md: 'h-4 w-4 border-2',
};

function useElapsedTime(enabled: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }
    startRef.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(id);
  }, [enabled]);

  return elapsed;
}

interface LoadingSpinnerProps {
  message: string;
  size?: SpinnerSize;
  showElapsed?: boolean;
}

export function LoadingSpinner({ message, size = 'md', showElapsed = false }: LoadingSpinnerProps) {
  const elapsed = useElapsedTime(showElapsed);

  return (
    <div className="flex items-center gap-2 text-dark-400 text-sm">
      <div className={`animate-spin ${sizeStyles[size]} border-dark-400 border-t-transparent rounded-full`} />
      {message}
      {showElapsed && elapsed >= 1000 && <span className="text-dark-500">{formatElapsed(elapsed)}</span>}
    </div>
  );
}
