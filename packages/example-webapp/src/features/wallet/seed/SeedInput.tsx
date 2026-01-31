import React, { useState, useCallback } from 'react';
import { validateSeed } from './validateSeed';

interface SeedInputProps {
  onSubmit: (seed: string) => void;
  disabled?: boolean;
}

export function SeedInput({ onSubmit, disabled }: SeedInputProps) {
  const [seed, setSeed] = useState('');
  const [showSeed, setShowSeed] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSeed(value);

      if (validationError) {
        setValidationError(null);
      }
    },
    [validationError],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const validation = validateSeed(seed);
      if (!validation.isValid) {
        setValidationError(validation.error || 'Invalid seed');
        return;
      }

      onSubmit(seed.trim().toLowerCase());
    },
    [seed, onSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-1">Wallet Seed (64 hex characters)</label>
        <div className="relative">
          <input
            type={showSeed ? 'text' : 'password'}
            value={seed}
            onChange={handleChange}
            placeholder="Enter your 64-character hex seed..."
            disabled={disabled}
            className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded text-white placeholder-dark-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShowSeed(!showSeed)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white text-sm"
          >
            {showSeed ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="mt-1 text-xs text-dark-500">{seed.length}/64 characters</div>
      </div>

      {validationError && <div className="text-red-400 text-sm">{validationError}</div>}

      <button
        type="submit"
        disabled={disabled || seed.length === 0}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Connect Wallet
      </button>

      <p className="text-xs text-dark-500">
        Your seed is never stored or transmitted. It remains only in memory during your session.
      </p>
    </form>
  );
}
