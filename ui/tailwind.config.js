/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wm: {
          bg:             '#0a1214',
          surface:        '#0f1f22',
          'surface-2':    '#152a2e',
          border:         '#1a3339',
          'border-hover': '#254a52',
          primary:        '#015c61',
          'primary-hover':'#004e54',
          accent:         '#2ea3f2',
          'accent-mid':   '#15779b',
          muted:          '#82c0c7',
          text:           '#f0f9fa',
          'text-dim':     '#a8cdd1',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
