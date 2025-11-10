/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ninad': {
          'black': '#000000',
          'gradient-start': '#210F00',
          'gradient-mid': '#B70000',
          'gradient-end': '#FF7700',
          'mic': '#B70000',
          'start-base': '#E99200',
          'start-hover': '#FF7700',
        },
        'text-primary': '#FFFFFF',
        'text-secondary': '#D9D9D9',
      },
      backgroundImage: {
        'ninad-gradient': 'linear-gradient(to top, #FF7700 0%, #000000 100%)',
        'button-start': 'linear-gradient(135deg, #E99200, #FF7700)',
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(183, 0, 0, 0.5)',
        'glow-orange': '0 0 20px rgba(255, 119, 0, 0.5)',
      },
    },
  },
  plugins: [],
}
