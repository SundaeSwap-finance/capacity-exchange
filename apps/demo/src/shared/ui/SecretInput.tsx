import React, { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';

interface SecretInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  onRandom?: () => void;
}

export function SecretInput({
  value,
  onChange,
  placeholder,
  disabled,
  maxLength,
  className = '',
  onRandom,
}: SecretInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex gap-2">
      <Input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className={`flex-1 font-mono ${className}`}
        autoComplete="off"
        spellCheck={false}
      />
      {onRandom && (
        <Button variant="ghost" onClick={onRandom} disabled={disabled} className="border" title="Generate random seed">
          🎲
        </Button>
      )}
      <Button variant="ghost" onClick={() => setVisible(!visible)} className="border">
        {visible ? 'Hide' : 'Show'}
      </Button>
    </div>
  );
}
