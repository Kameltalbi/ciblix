/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,tsx,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ciblix: {
          50: '#eff6ff',
          500: '#016AEB',
          600: '#0071DD',
          900: '#0f172a',
        },
      },
      width: { panel: '420px' },
    },
  },
  plugins: [],
};
