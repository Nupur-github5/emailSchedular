/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 50: '#eef4ff', 100: '#dbe6fe', 500: '#4f6ef7', 600: '#3b5bdb', 700: '#2f4ac0' },
      },
    },
  },
  plugins: [],
};
