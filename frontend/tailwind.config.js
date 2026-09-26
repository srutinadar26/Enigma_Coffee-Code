/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0B1220', // keep dark base
          900: '#0F172A', // Navy
          800: '#1E293B',
          700: '#334155'
        },
        brand: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155'
        },
        accent: {
          gold: '#D4AF37'
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['"Outfit"', 'sans-serif']
      }
    }
  },
  plugins: []
};
