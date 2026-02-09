import type { InputHTMLAttributes } from 'react';

const INPUT_SIZES = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-2 text-sm',
} as const;

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  scale?: keyof typeof INPUT_SIZES;
}

export function Input({ scale = 'md', className = '', ...props }: InputProps) {
  return (
    <input
      className={`
        ${INPUT_SIZES[scale]}
        bg-dark-800 border border-dark-600 rounded text-white
        placeholder-dark-500 focus:outline-none focus:border-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    />
  );
}
