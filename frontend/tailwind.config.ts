import type { Config } from 'tailwindcss';

/** CIBLIX — palette premium AI SaaS */
const brand = {
  DEFAULT: '#2563EB',
  soft: '#BED6F6',
  nav: '#0F172A',
  accent: '#7C3AED',
} as const;

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        border: '#E2E8F0',
        input: '#E2E8F0',
        ring: '#2563EB',
        background: '#F7F9FC',
        foreground: '#0F172A',
        primary: {
          DEFAULT: '#2563EB',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#64748B',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#64748B',
        },
        accent: {
          DEFAULT: '#7C3AED',
          foreground: '#FFFFFF',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#0F172A',
        },
        brand,
        /** Vert CIBLIX (boutons, accents landing/tarifs) */
        leaf: {
          DEFAULT: '#16A34A',
          foreground: '#FFFFFF',
        },
        sidebar: '#0F172A',
        'sidebar-text': '#94A3B8',
        'sidebar-hover': '#1E293B',
        'sidebar-active': '#2563EB',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 8px 24px -8px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 24px -4px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)',
        glow: '0 0 0 1px rgba(37, 99, 235, 0.1), 0 8px 32px -8px rgba(37, 99, 235, 0.15)',
        'sidebar-active': 'inset 0 0 0 1px rgba(37, 99, 235, 0.3), 0 0 20px -4px rgba(37, 99, 235, 0.2)',
      },
      borderRadius: {
        lg: '20px',
        md: '16px',
        sm: '12px',
        '2xl': '24px',
        '3xl': '28px',
      },
      backgroundImage: {
        'ai-glow':
          'radial-gradient(ellipse 120% 80% at 100% -20%, rgba(124, 58, 237, 0.15) 0%, transparent 50%), radial-gradient(ellipse 80% 60% at 0% 100%, rgba(37, 99, 235, 0.08) 0%, transparent 45%)',
        'hero-ai': 'linear-gradient(135deg, rgba(247, 249, 252, 0.98) 0%, rgba(241, 245, 249, 0.95) 50%, rgba(237, 242, 247, 0.9) 100%)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
