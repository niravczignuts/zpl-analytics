/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        zpl: {
          navy:        '#060D28',
          'navy-mid':  '#091850',
          blue:        '#1440C0',
          'blue-light':'#2A52C0',
          'blue-sky':  '#1E70D8',
          gold:        '#FFD700',
          'gold-dark': '#D4AA00',
          'gold-pale': '#FFE566',
          red:         '#CC1020',
          'red-dark':  '#991018',
          white:       '#F0F4FF',
        },
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        display: ['var(--font-outfit)', 'sans-serif'],
        body:    ['var(--font-dm-sans)', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        'zpl-hero':   'linear-gradient(135deg, #060D28 0%, #1440C0 50%, #060D28 100%)',
        'gold-shine': 'linear-gradient(135deg, #7A5500 0%, #D4AA00 40%, #FFD700 60%, #D4AA00 100%)',
        'navy-card':  'linear-gradient(145deg, oklch(0.12 0.05 258) 0%, oklch(0.09 0.04 258) 100%)',
      },
      boxShadow: {
        'gold':     '0 0 16px rgba(255,215,0,0.2), 0 0 48px rgba(255,215,0,0.06)',
        'gold-sm':  '0 0 8px rgba(255,215,0,0.25)',
        'blue':     '0 0 20px rgba(30,80,220,0.25), 0 0 60px rgba(30,80,220,0.08)',
        'navy':     '0 8px 32px rgba(6,13,40,0.6)',
        'card':     '0 4px 24px rgba(0,0,0,0.4)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "pulse-gold": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255,215,0,0.4)" },
          "50%":      { boxShadow: "0 0 0 8px rgba(255,215,0,0)" },
        },
        "glow-breathe": {
          "0%, 100%": { opacity: "0.6" },
          "50%":      { opacity: "1" },
        },
        "float-up": {
          "0%":   { transform: "translateY(0px)" },
          "50%":  { transform: "translateY(-6px)" },
          "100%": { transform: "translateY(0px)" },
        },
        "slide-in-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
      animation: {
        "accordion-down":  "accordion-down 0.2s ease-out",
        "accordion-up":    "accordion-up 0.2s ease-out",
        "pulse-gold":      "pulse-gold 2s infinite",
        "glow-breathe":    "glow-breathe 2.5s ease-in-out infinite",
        "float-up":        "float-up 3s ease-in-out infinite",
        "slide-in-up":     "slide-in-up 0.3s ease-out",
        shimmer:           "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
