/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      colors: {
        ink: {
          950: '#070b15',
          900: '#0b1220',
          800: '#111a2e',
          700: '#1a2540',
          600: '#27345a',
          500: '#7e8db5',  // novo: borderline AAA
          400: '#9aa6c8',  // bumpado de #6b7aa3 (era ~5:1, agora ~7.5:1)
          300: '#b9c2dd',  // novo: tertiary com bom contraste
          200: '#dde3f2',  // bumpado de #cbd3e8 — quase branco
          100: '#eef1f9'
        },
        lime: {
          400: '#c8ff3d',
          500: '#a6e22e'
        },
        sun: {
          400: '#ffd35a',
          500: '#ffb422'
        },
        coral: {
          400: '#ff6b6b',
          500: '#ff4757'
        }
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(200,255,61,0.18), 0 10px 40px -10px rgba(200,255,61,0.35)',
        card: '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 50px -20px rgba(0,0,0,0.6)'
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"
      }
    }
  },
  plugins: []
};
