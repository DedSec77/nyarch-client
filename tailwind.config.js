/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette is driven by CSS variables (channel triples) so themes can
        // swap it live AND keep Tailwind opacity modifiers (e.g. /60) working.
        term: {
          950: 'rgb(var(--term-950) / <alpha-value>)',
          900: 'rgb(var(--term-900) / <alpha-value>)',
          850: 'rgb(var(--term-850) / <alpha-value>)',
          800: 'rgb(var(--term-800) / <alpha-value>)',
          750: 'rgb(var(--term-750) / <alpha-value>)',
          700: 'rgb(var(--term-700) / <alpha-value>)',
        },
        neon: {
          green: 'rgb(var(--neon-green) / <alpha-value>)',
          cyan: 'rgb(var(--neon-cyan) / <alpha-value>)',
          magenta: 'rgb(var(--neon-magenta) / <alpha-value>)',
          amber: 'rgb(var(--neon-amber) / <alpha-value>)',
          red: 'rgb(var(--neon-red) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          dim: 'rgb(var(--ink-dim) / <alpha-value>)',
          faint: 'rgb(var(--ink-faint) / <alpha-value>)',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 0 1px rgba(0,255,156,0.25), 0 0 18px -4px rgba(0,255,156,0.35)',
        'neon-cyan': '0 0 0 1px rgba(34,211,238,0.25), 0 0 18px -4px rgba(34,211,238,0.35)',
        glow: '0 0 24px -6px rgba(0,255,156,0.25)',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.6' },
          '94%': { opacity: '1' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'seam-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        blink: 'blink 1s step-end infinite',
        flicker: 'flicker 4s linear infinite',
        scan: 'scan 6s linear infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in-left': 'slide-in-left 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
        'seam-shift': 'seam-shift 6s linear infinite',
      },
    },
  },
  plugins: [],
}
