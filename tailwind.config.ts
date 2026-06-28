import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          // Numeric scale (used throughout existing code)
          50:      '#ECF0FA',
          100:     '#E8F0FE',
          200:     '#BFDBFE',
          300:     '#93C5FD',
          400:     '#60A5FA',
          500:     '#3B82F6',
          600:     '#2563EB',
          700:     '#1D4ED8',
          800:     '#1E40AF',
          900:     '#1E3A8A',
          // Named aliases (section 18)
          deep:    '#1E3A8A',
          primary: '#3B82F6',
          soft:    '#93C5FD',
          surface: '#E8F0FE',
          bg:      '#F0F5FF',
        },
        status: {
          danger:  '#EF4444',
          success: '#22C55E',
          warning: '#F59E0B',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
