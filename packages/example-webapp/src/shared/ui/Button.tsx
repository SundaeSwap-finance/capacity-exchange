import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react';

const VARIANTS = {
  accent: 'ces-btn',
  blue: 'ces-btn',
  green: 'ces-btn',
  purple: 'ces-btn',
  red: 'ces-btn',
  ghost: 'ces-btn-ghost',
} as const;

const SIZES = {
  sm: '[--ces-btn-font-size:1.125rem] [--ces-btn-pad-x:0.75rem] [--ces-btn-pad-y:0.55rem] [--ces-btn-arrow-w:3rem] [--ces-btn-arrow-h:1rem]',
  md: '[--ces-btn-font-size:1.9rem] [--ces-btn-pad-x:1rem] [--ces-btn-pad-y:0.8rem] [--ces-btn-arrow-w:4.75rem] [--ces-btn-arrow-h:1.9rem]',
  lg: '[--ces-btn-font-size:2.55rem] [--ces-btn-pad-x:1.2rem] [--ces-btn-pad-y:0.95rem] [--ces-btn-arrow-w:5.75rem] [--ces-btn-arrow-h:2.4rem]',
} as const;

type ButtonStyleVars = CSSProperties & {
  '--ces-button-fill'?: string;
  '--ces-button-ink'?: string;
  '--ces-button-border'?: string;
};

const VARIANT_STYLES = {
  accent: {
    '--ces-button-fill': 'var(--ces-color-accent)',
    '--ces-button-ink': 'var(--ces-white)',
    '--ces-button-border': 'var(--ces-black)',
  },
  blue: {
    '--ces-button-fill': 'var(--ces-color-accent)',
    '--ces-button-ink': 'var(--ces-white)',
    '--ces-button-border': 'var(--ces-black)',
  },
  green: {
    '--ces-button-fill': 'var(--ces-color-gold)',
    '--ces-button-ink': 'var(--ces-black)',
    '--ces-button-border': 'var(--ces-black)',
  },
  purple: {
    '--ces-button-fill': 'var(--ces-color-surface-solid)',
    '--ces-button-ink': 'var(--ces-color-accent)',
    '--ces-button-border': 'var(--ces-color-accent)',
  },
  red: {
    '--ces-button-fill': 'var(--ces-color-danger)',
    '--ces-button-ink': 'var(--ces-black)',
    '--ces-button-border': 'var(--ces-black)',
  },
  ghost: {
    '--ces-button-ink': 'var(--ces-color-text-muted)',
    '--ces-button-border': 'var(--ces-color-border)',
  },
} as const satisfies Record<keyof typeof VARIANTS, ButtonStyleVars>;

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
  style,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      style={{ ...VARIANT_STYLES[variant], ...style }}
      className={`
        ${VARIANTS[variant]}
        ${SIZES[size]}
        ${fullWidth ? 'w-full' : ''}
        min-w-0
        ${variant === 'ghost' ? '' : 'justify-start'}
        disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      <span className={`${variant === 'ghost' ? '' : 'block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap'}`}>
        {children}
      </span>
    </button>
  );
}
