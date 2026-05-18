/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        chat: {
          bg: '#0f0f0f',
          surface: '#1a1a1a',
          border: '#2a2a2a',
          hover: '#252525',
          user: '#2563eb',
          accent: '#8b5cf6',
        },
      },
    },
  },
  plugins: [],
}
