import { useState } from 'react';
import type { ShieldedToken } from '../lib/vaultTokens';

interface ShieldedTokenSelectProps {
  tokens: ShieldedToken[];
  selectedColor: string | null;
  onSelect: (token: ShieldedToken) => void;
}

function TokenOption({
  token,
  isSelected,
  onSelect,
}: {
  token: ShieldedToken;
  isSelected: boolean;
  onSelect: (token: ShieldedToken) => void;
}) {
  return (
    <label
      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
        isSelected ? 'bg-dark-700' : 'hover:bg-dark-800'
      }`}
    >
      <input
        type="radio"
        name="shielded-token"
        checked={isSelected}
        onChange={() => onSelect(token)}
        className="accent-blue-500"
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-dark-100">{token.vaultLabel}</span>
        <div className="text-xs text-dark-400 mt-0.5">Balance: {token.balance.toString()}</div>
      </div>
    </label>
  );
}

export function ShieldedTokenSelect({ tokens, selectedColor, onSelect }: ShieldedTokenSelectProps) {
  const [expanded, setExpanded] = useState(false);
  const selected = tokens.find((t) => t.color === selectedColor);

  const toggleExpanded = () => setExpanded(!expanded);

  const handleSelect = (token: ShieldedToken) => {
    onSelect(token);
    setExpanded(false);
  };

  if (tokens.length === 0) {
    return (
      <div>
        <label className="label">Shielded tokens</label>
        <div className="input bg-dark-800/50 text-dark-400">No shielded tokens found</div>
      </div>
    );
  }

  return (
    <div>
      <label className="label">Shielded tokens</label>
      <button type="button" className="input text-left flex items-center justify-between" onClick={toggleExpanded}>
        <span className={selected ? 'text-dark-100' : 'text-dark-500'}>
          {selected ? `${selected.vaultLabel} — ${selected.balance.toString()}` : 'Select a token to withdraw'}
        </span>
        <span className="text-dark-400 text-xs">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {expanded && (
        <div className="mt-1 rounded-lg border border-dark-700 bg-dark-900 overflow-hidden">
          {tokens.map((token) => (
            <TokenOption
              key={token.color}
              token={token}
              isSelected={token.color === selectedColor}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
