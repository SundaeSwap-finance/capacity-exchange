/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ces: {
          void: '#0A0E1A',
          surface: '#131929',
          'surface-raised': '#1C2440',
          text: '#E8ECF4',
          'text-muted': '#6B7A99',
          accent: '#4AE3B5',
          'accent-hover': '#3CC9A0',
          gold: '#F0C956',
          danger: '#F06565',
          border: '#1F2B45',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
