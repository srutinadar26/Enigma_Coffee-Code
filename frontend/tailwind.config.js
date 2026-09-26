/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b1220',
          900: '#111a2e',
          800: '#182338',
          700: '#233251'
        },
        brand: {
          50: '#f0f7ff',
          100: '#dbeeff',
          400: '#4f9cf9',
          500: '#2b7de9',
          600: '#1c63c9',
          700: '#194f9e'
        },
        accent: {
          gold: '#c9a24b'
        }
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
