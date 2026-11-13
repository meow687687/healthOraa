/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aura: {
          canvas: '#07080C',
          s1: '#0E1016',
          s2: '#151823',
          s3: '#1D2130',
          line: 'rgba(255, 255, 255, 0.08)',
          line2: 'rgba(255, 255, 255, 0.14)',
        },
        accent: {
          blue: '#4387F6',
          'blue-glow': 'rgba(67, 135, 246, 0.25)',
          emerald: '#10B981',
          'emerald-glow': 'rgba(16, 185, 129, 0.25)',
          amber: '#FFB020',
          red: '#FF5A6E',
          violet: '#8B6CFF',
        },
        text: {
          primary: '#F4F6FB',
          secondary: '#A3A9BA',
          muted: '#838899',
        }
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        '4xl': '32px',
        '3xl': '24px',
        '2xl': '16px',
        'pill': '9999px',
      },
      boxShadow: {
        'aura-card': '0 20px 40px -15px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.04), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
        'aura-elevated': '0 12px 30px -8px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)',
      }
    },
  },
  plugins: [],
};
