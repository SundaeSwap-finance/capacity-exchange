import React, { useState, useEffect } from 'react';

interface EditableFieldProps {
  label: string;
  value: string;
  defaultValue: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
  disabled?: boolean;
}

export function EditableField({
  label,
  value,
  defaultValue,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const hasDefault = defaultValue !== null && defaultValue !== '';
  const isModified = value !== defaultValue;

  // Auto-collapse when value matches default
  useEffect(() => {
    if (value === defaultValue && isEditing) {
      setIsEditing(false);
    }
  }, [value, defaultValue, isEditing]);

  const handleReset = () => {
    if (defaultValue !== null) {
      onChange(defaultValue);
      setIsEditing(false);
    }
  };

  return (
    <div className="p-2 bg-dark-800 rounded border border-dark-600">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-dark-400">{label}</span>
        <div className="flex items-center gap-1">
          {isModified && hasDefault && (
            <button
              onClick={handleReset}
              disabled={disabled}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
              title="Reset to default"
            >
              Reset
            </button>
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            disabled={disabled}
            className="text-xs text-dark-400 hover:text-dark-200 disabled:opacity-50"
            title={isEditing ? 'Collapse' : 'Edit'}
          >
            {isEditing ? '▲' : '✎'}
          </button>
        </div>
      </div>

      {!isEditing ? (
        <div
          className={`text-xs font-mono break-all truncate cursor-pointer hover:text-dark-200 ${
            value ? 'text-white' : 'text-dark-500 italic'
          }`}
          onClick={() => !disabled && setIsEditing(true)}
          title={value || placeholder || 'Click to edit'}
        >
          {value || placeholder || 'Not set'}
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-2 py-1 text-xs font-mono bg-dark-900 border border-dark-500 rounded text-white placeholder-dark-500 focus:outline-none focus:border-blue-500"
          autoFocus
        />
      )}

      {isModified && hasDefault && (
        <div className="mt-1 text-xs text-yellow-500">Modified from default</div>
      )}
    </div>
  );
}
