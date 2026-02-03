import React from 'react';

interface InfoRowProps {
  label: string;
  value: string;
}

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div>
      <span className="text-dark-500">{label}:</span> <span className="font-mono text-dark-300 break-all">{value}</span>
    </div>
  );
}
