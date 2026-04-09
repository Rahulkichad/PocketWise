/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { lg: '1024px', xl: '1200px', '2xl': '1320px' } },
    extend: {
      fontFamily: {
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },
      colors: {
        app: 'var(--bg-app)',
        card: 'var(--bg-card)',
        primary: { DEFAULT: 'var(--primary)', 50: '#eff6ff', 100: '#dbeafe', 600: '#2563eb' },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        ink: 'var(--text-primary)',
        muted: 'var(--text-muted)'
      },
      boxShadow: {
        'sm-soft': '0 1px 2px rgba(16,24,40,0.06), 0 1px 1px rgba(16,24,40,0.04)',
        'md-soft': '0 2px 8px rgba(16,24,40,0.08)',
      },
      borderRadius: {
        '2xl': '1rem',
      },
      backgroundImage: {
        'header-gradient': 'linear-gradient(180deg, rgba(37,99,235,0.06) 0%, rgba(37,99,235,0.00) 100%)',
        'nav-gradient': 'linear-gradient(180deg, rgba(15,23,42,0.02) 0%, rgba(15,23,42,0.00) 100%)',
      },
      transitionTimingFunction: {
        'emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
};
