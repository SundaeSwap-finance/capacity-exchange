import React, { useState } from 'react';

interface SecretInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
}

export function SecretInput({ value, onChange, placeholder, disabled, maxLength, className = '' }: SecretInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex gap-2">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        className={`flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded text-white placeholder-dark-500 focus:outline-none focus:border-blue-500 font-mono text-sm ${className}`}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="px-3 py-2 bg-dark-800 border border-dark-600 rounded text-dark-400 hover:text-white text-sm transition-colors"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
