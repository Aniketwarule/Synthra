/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'terminal-bg': '#0A0A0A',
        'terminal-surface': '#111111',
        'terminal-border': '#1A1A1A',
        'terminal-green': '#00FFA3',
        'terminal-green-dim': '#00FFA333',
        'terminal-teal': '#00D4AA',
        'terminal-yellow': '#FFD93D',
        'terminal-red': '#FF4444',
        'terminal-dim': '#4A4A4A',
        'terminal-muted': '#666666',
        'terminal-text': '#E0E0E0',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'blink': 'blink 1s step-end infinite',
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'typewriter': 'typewriter 0.05s steps(1) forwards',
        'scan-line': 'scan-line 8s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
}
