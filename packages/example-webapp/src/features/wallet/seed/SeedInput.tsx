import React, { useState, useCallback } from 'react';
import { SecretInput, CharacterCounter } from '../../../shared/ui';
import { validateSeed } from './validateSeed';

const SEED_LENGTH = 64;

interface SeedInputProps {
  onSubmit: (seed: string) => void;
  disabled?: boolean;
}

export function SeedInput({ onSubmit, disabled }: SeedInputProps) {
  const [seed, setSeed] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSeed(e.target.value);
      if (validationError) {
        setValidationError(null);
      }
    },
    [validationError]
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
    [seed, onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-1">
          Wallet Seed ({SEED_LENGTH} hex characters)
        </label>
        <SecretInput
          value={seed}
          onChange={handleChange}
          placeholder={`Enter your ${SEED_LENGTH}-character hex seed...`}
          disabled={disabled}
          maxLength={SEED_LENGTH}
        />
        <CharacterCounter current={seed.length} max={SEED_LENGTH} />
      </div>

      {validationError && <div className="text-red-400 text-sm">{validationError}</div>}

      <button
        type="submit"
        disabled={disabled || seed.length === 0}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Connect Wallet
      </button>
    </form>
  );
}
