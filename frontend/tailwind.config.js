import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src/**/*.{js,jsx}'),
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#5B8CFF',
          blueLight: 'rgba(91,140,255,0.12)',
          blueDark: '#4A7AEE',
        },
        ink: {
          900: '#E5E7EB',
          700: '#C9CDD4',
          500: '#9CA3AF',
          400: '#6B7280',
          300: '#4B5563',
          200: '#374151',
          100: 'rgba(255,255,255,0.06)',
          50: 'rgba(255,255,255,0.03)',
        },
        line: {
          light: 'rgba(255,255,255,0.08)',
          medium: 'rgba(255,255,255,0.12)',
        },
        danger: '#EF4444',
        warn: '#F59E0B',
        success: '#22C55E',
        accent: '#7C3AED',
        teal: '#22D3EE',
        page: '#0B0F1A',
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(0,0,0,0.3)',
        'card': '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.5), 0 0 20px rgba(91,140,255,0.08)',
        'elevated': '0 10px 30px rgba(0,0,0,0.5)',
        'modal': '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)',
        'glow': '0 0 20px rgba(91,140,255,0.35)',
        'glow-sm': '0 0 12px rgba(91,140,255,0.25)',
        'glow-danger': '0 0 12px rgba(239,68,68,0.3)',
        'glow-success': '0 0 12px rgba(34,197,94,0.3)',
      },
      borderRadius: {
        'card': '16px',
        'pill': '100px',
        'input': '12px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        'xs': ['11px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        'sm': ['13px', { lineHeight: '20px' }],
        'base': ['14px', { lineHeight: '22px' }],
        'md': ['15px', { lineHeight: '24px' }],
        'lg': ['17px', { lineHeight: '26px', letterSpacing: '-0.01em' }],
        'xl': ['20px', { lineHeight: '28px', letterSpacing: '-0.02em' }],
        '2xl': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
        '3xl': ['28px', { lineHeight: '36px', letterSpacing: '-0.03em' }],
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
