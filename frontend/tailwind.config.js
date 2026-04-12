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
          blue: '#4A6CF7',
          blueLight: '#EEF2FF',
          blueDark: '#3B5DE7',
        },
        ink: {
          900: '#111827',
          700: '#374151',
          500: '#6B7280',
          400: '#9CA3AF',
          300: '#D1D5DB',
          200: '#E5E7EB',
          100: '#F3F4F6',
          50: '#F9FAFB',
        },
        line: {
          light: '#F3F4F6',
          medium: '#E5E7EB',
        },
        danger: '#EF4444',
        warn: '#F59E0B',
        success: '#10B981',
        accent: '#8B5CF6',
        teal: '#06B6D4',
        page: '#FAFBFC',
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(0,0,0,0.04)',
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        'elevated': '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
        'modal': '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        'card': '14px',
        'pill': '100px',
        'input': '10px',
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
