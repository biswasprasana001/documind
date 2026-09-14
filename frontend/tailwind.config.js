/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brutal-bg': '#FDFBF7', // Cream background
        'brutal-primary': '#FF6B6B', // Redish pink
        'brutal-secondary': '#4ECDC4', // Teal
        'brutal-yellow': '#FFE66D',
      },
      boxShadow: {
        'brutal': '4px 4px 0px 0px rgba(0,0,0,1)',
        'brutal-sm': '2px 2px 0px 0px rgba(0,0,0,1)',
        'brutal-lg': '8px 8px 0px 0px rgba(0,0,0,1)',
      }
    },
  },
  plugins: [],
}
