/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: v('cream'),
        surface: v('surface'),
        well: v('well'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        mint: { DEFAULT: v('mint'), deep: v('mint-deep'), soft: v('mint-soft') },
        peach: { DEFAULT: v('peach'), deep: v('peach-deep'), soft: v('peach-soft') },
        butter: v('butter'),
      },
      fontFamily: {
        sans: ['"Nunito Variable"', 'ui-rounded', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: {
        card: '0 1px 0 rgb(var(--line) / 0.9), 0 8px 24px -16px rgb(var(--ink) / 0.25)',
        pop: '0 12px 32px -12px rgb(var(--ink) / 0.35)',
      },
      keyframes: {
        spin: { to: { transform: 'rotate(360deg)' } },
        roll: {
          '0%': { transform: 'translateX(-8px)' },
          '50%': { transform: 'translateX(8px)' },
          '100%': { transform: 'translateX(-8px)' },
        },
        bob: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-1.5px)' } },
        ride: { '0%': { transform: 'translateX(-40px)' }, '100%': { transform: 'translateX(calc(100% + 40px))' } },
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: {
        wheel: 'spin 1.6s linear infinite',
        'wheel-fast': 'spin 0.5s linear infinite',
        roll: 'roll 6s ease-in-out infinite',
        bob: 'bob 0.8s ease-in-out infinite',
        'fade-up': 'fade-up 220ms ease-out both',
      },
    },
  },
  plugins: [],
};
