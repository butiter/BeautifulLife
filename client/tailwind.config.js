export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"IBM Plex Sans"', 'system-ui', 'sans-serif']
      },
      colors: {
        'glass-dark': 'rgba(15, 18, 24, 0.8)'
      }
    }
  },
  plugins: []
};
