const colorVar = (token) => `rgb(var(${token}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ces: {
          void: colorVar('--tw-ces-void'),
          surface: colorVar('--tw-ces-surface'),
          'surface-solid': colorVar('--tw-ces-surface-solid'),
          'surface-raised': colorVar('--tw-ces-surface-raised'),
          text: colorVar('--tw-ces-text'),
          'text-muted': colorVar('--tw-ces-text-muted'),
          accent: colorVar('--tw-ces-accent'),
          'accent-hover': colorVar('--tw-ces-accent-hover'),
          gold: colorVar('--tw-ces-gold'),
          danger: colorVar('--tw-ces-danger'),
          border: colorVar('--tw-ces-border'),
        },
      },
      fontFamily: {
        sans: ['var(--tw-ces-font-sans)'],
        display: ['var(--tw-ces-font-display)'],
        mono: ['var(--tw-ces-font-mono)'],
      },
    },
  },
  plugins: [],
};
