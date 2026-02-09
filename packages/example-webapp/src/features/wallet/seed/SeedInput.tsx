import React, { useState, useCallback } from 'react';
import { Button, SecretInput, CharacterCounter } from '../../../shared/ui';
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
          placeholder={`Enter or generate a ${SEED_LENGTH}-char hex seed...`}
          disabled={disabled}
          maxLength={SEED_LENGTH}
          onRandom={() => {
            const bytes = crypto.getRandomValues(new Uint8Array(32));
            const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
            setSeed(hex);
            setValidationError(null);
          }}
        />
        <CharacterCounter current={seed.length} max={SEED_LENGTH} />
      </div>

      {validationError && <div className="text-red-400 text-sm">{validationError}</div>}

      <Button type="submit" variant="blue" fullWidth disabled={disabled || seed.length === 0}>
        Connect Wallet
      </Button>
    </form>
  );
}
