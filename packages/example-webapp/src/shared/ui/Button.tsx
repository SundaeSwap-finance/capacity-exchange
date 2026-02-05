import type { ReactNode, ButtonHTMLAttributes } from 'react';

const VARIANTS = {
  green: 'bg-green-600 hover:bg-green-700 text-white',
  blue: 'bg-blue-600 hover:bg-blue-700 text-white',
  purple: 'bg-purple-600 hover:bg-purple-700 text-white',
  red: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'text-dark-400 hover:text-white',
} as const;

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'blue',
  size = 'md',
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`
        ${VARIANTS[variant]}
        ${SIZES[size]}
        ${fullWidth ? 'w-full' : ''}
        rounded transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
