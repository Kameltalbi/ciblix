import type { Config } from 'tailwindcss';

/** KTOptima — palette officielle (SaaS IA premium, clair) */
const brand = {
  DEFAULT: '#016AEB',
  soft: '#BED6F6',
  nav: '#1E72B9',
  accent: '#0071DD',
} as const;

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        /** Titres / display — Plus Jakarta Sans (chargé comme "serif" historique du projet) */
        serif: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        brand,
        /** Rétrocompat : ancien vert → identité bleue (éviter vert dominant) */
        leaf: { DEFAULT: brand.DEFAULT, mid: brand.accent, light: brand.soft },
        sage: { DEFAULT: '#eef4fc', deep: '#e2ebf8' },
        amber: { DEFAULT: '#c67c2a', light: '#fdf3e7' },
        coral: { DEFAULT: '#c0392b', light: '#fdecea' },
        gold: { DEFAULT: '#b5860d', light: '#fef9e7' },
        purple: { DEFAULT: '#6c3483', light: '#f4ecf7' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(1, 106, 235, 0.04), 0 8px 24px -8px rgba(30, 114, 185, 0.08)',
        'card-hover': '0 4px 20px -4px rgba(1, 106, 235, 0.12), 0 0 0 1px rgba(190, 214, 246, 0.5)',
        glow: '0 0 0 1px rgba(190, 214, 246, 0.6), 0 8px 32px -8px rgba(1, 106, 235, 0.25)',
        'nav-active': 'inset 0 0 0 1px rgba(255,255,255,0.22), 0 0 24px -4px rgba(190, 214, 246, 0.35)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      backgroundImage: {
        'kt-mesh':
          'radial-gradient(ellipse 120% 80% at 100% -20%, rgba(190, 214, 246, 0.45) 0%, transparent 50%), radial-gradient(ellipse 80% 60% at 0% 100%, rgba(1, 106, 235, 0.06) 0%, transparent 45%)',
        'kt-hero': 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(238, 244, 252, 0.9) 50%, rgba(190, 214, 246, 0.25) 100%)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
