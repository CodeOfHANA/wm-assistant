/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wm: {
          bg:             'rgb(var(--wm-bg) / <alpha-value>)',
          surface:        'rgb(var(--wm-surface) / <alpha-value>)',
          'surface-2':    'rgb(var(--wm-surface-2) / <alpha-value>)',
          border:         'rgb(var(--wm-border) / <alpha-value>)',
          'border-hover': 'rgb(var(--wm-border-hover) / <alpha-value>)',
          primary:        'rgb(var(--wm-primary) / <alpha-value>)',
          'primary-hover':'rgb(var(--wm-primary-hover) / <alpha-value>)',
          accent:         'rgb(var(--wm-accent) / <alpha-value>)',
          'accent-mid':   'rgb(var(--wm-accent-mid) / <alpha-value>)',
          muted:          'rgb(var(--wm-muted) / <alpha-value>)',
          text:           'rgb(var(--wm-text) / <alpha-value>)',
          'text-dim':     'rgb(var(--wm-text-dim) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
