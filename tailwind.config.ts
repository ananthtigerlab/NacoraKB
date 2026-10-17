import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // PRD §10 brand tokens — deep marine blue on white-dominant surfaces.
        // Starting defaults; replace with exact hexes sampled from the Nacora Figma file.
        primary: {
          DEFAULT: 'hsl(var(--color-primary))',
          foreground: 'hsl(var(--color-primary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--color-primary-accent))',
          foreground: 'hsl(var(--color-primary-accent-foreground))',
        },
        surface: {
          DEFAULT: 'hsl(var(--color-surface))',
          muted: 'hsl(var(--color-surface-muted))',
        },
        text: {
          DEFAULT: 'hsl(var(--color-text))',
          muted: 'hsl(var(--color-text-muted))',
          subtle: 'hsl(var(--color-text-subtle))',
        },
        border: {
          DEFAULT: 'hsl(var(--color-border))',
          muted: 'hsl(var(--color-border-muted))',
        },
        input: 'hsl(var(--color-border))',
        ring: 'hsl(var(--color-primary-accent))',
        background: 'hsl(var(--color-surface))',
        foreground: 'hsl(var(--color-text))',
        muted: {
          DEFAULT: 'hsl(var(--color-surface-muted))',
          foreground: 'hsl(var(--color-text-muted))',
        },
        card: {
          DEFAULT: 'hsl(var(--color-surface))',
          foreground: 'hsl(var(--color-text))',
        },
        popover: {
          DEFAULT: 'hsl(var(--color-surface))',
          foreground: 'hsl(var(--color-text))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--color-danger))',
          foreground: 'hsl(var(--color-primary-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--color-warning))',
          foreground: 'hsl(var(--color-text))',
        },
        success: {
          DEFAULT: 'hsl(var(--color-success))',
          foreground: 'hsl(var(--color-primary-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 150ms ease-out',
        'accordion-up': 'accordion-up 150ms ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
