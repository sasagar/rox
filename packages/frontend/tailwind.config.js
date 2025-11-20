/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff5f2',
          100: '#ffe8de',
          200: '#ffcfbd',
          300: '#ffad8b',
          400: '#ff7f48',
          500: '#ff5b11',  // Main theme color
          600: '#f04700',
          700: '#c73700',
          800: '#9e2e00',
          900: '#7f2700',
          950: '#451300',
        },
      },
    },
  },
  plugins: [],
};
