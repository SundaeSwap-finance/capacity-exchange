import React, { useState, useEffect, useRef } from 'react';

interface BalanceBoxProps {
  label: string;
  value: string;
}

export function BalanceBox({ label, value }: BalanceBoxProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  const prevValueRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip flash on initial render
    if (prevValueRef.current !== null && prevValueRef.current !== value) {
      setIsFlashing(true);
      const timeout = setTimeout(() => setIsFlashing(false), 1500);
      return () => clearTimeout(timeout);
    }
    prevValueRef.current = value;
  }, [value]);

  return (
    <div
      className={`px-3 py-2 rounded transition-colors duration-300 ${
        isFlashing ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-dark-800'
      }`}
    >
      <div className="text-xs text-dark-500 mb-1">{label}</div>
      <div
        className={`text-sm font-mono transition-colors duration-300 ${
          isFlashing ? 'text-yellow-300 font-bold' : 'text-dark-200'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
