import React from 'react';

interface BalanceBoxProps {
  label: string;
  value: string;
}

export function BalanceBox({ label, value }: BalanceBoxProps) {
  return (
    <div className="bg-dark-800 px-3 py-2 rounded">
      <div className="text-xs text-dark-500 mb-1">{label}</div>
      <div className="text-sm text-dark-200 font-mono">{value}</div>
    </div>
  );
}
