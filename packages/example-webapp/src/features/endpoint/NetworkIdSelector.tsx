import React from 'react';

const VALID_NETWORK_IDS = ['undeployed', 'preview'];

interface NetworkIdSelectorProps {
  networkId: string;
  onChange: (networkId: string) => void;
}

export function NetworkIdSelector({ networkId, onChange }: NetworkIdSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-dark-500 text-sm">Network ID</span>
      <select
        value={networkId}
        onChange={(e) => onChange(e.target.value)}
        className="bg-dark-800 border border-dark-600 rounded px-2 py-1 text-sm text-dark-200 focus:outline-none focus:border-dark-500"
      >
        {VALID_NETWORK_IDS.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </div>
  );
}
