/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0B0D12',
          800: '#111420',
          700: '#181C2B',
          600: '#232838',
          500: '#333A4F',
        },
        brand: {
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        accent: '#5B8DEF',
      },
      fontFamily: {
        sans: ['Inter', 'Open Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      keyframes: {
        'ticker-in': { '0%': { opacity: '0', transform: 'translateY(-6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'coin-pop': { '0%': { transform: 'scale(0.8)', opacity: '0' }, '60%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'ticker-in': 'ticker-in .35s ease-out',
        'coin-pop': 'coin-pop .4s ease-out',
      },
    },
  },
  plugins: [],
};
