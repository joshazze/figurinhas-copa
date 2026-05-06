/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      colors: {
        // Fundo navy profundo — referência ao azul da bandeira dos EUA
        ink: {
          950: '#050b1f',
          900: '#0a1330',
          800: '#101e44',
          700: '#1a2a5c',
          600: '#2a3d7a',
          500: '#7886b8',
          400: '#9aa6cf',
          300: '#c1c9e3',
          200: '#dde3f2',
          100: '#eef1f9'
        },
        // Verde gramado / México
        pitch: {
          400: '#22c55e',
          500: '#16a34a',
          600: '#0e8a3e'
        },
        // Vermelho seleção (USA / Canadá / México)
        flag: {
          400: '#ef4444',
          500: '#dc2626',
          600: '#b91c1c'
        },
        // Azul bandeira USA
        sky26: {
          400: '#3b82f6',
          500: '#1d4ed8',
          600: '#1e3a8a'
        },
        // Dourado da taça
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706'
        },
        // Off-white papel-figurinha
        cream: {
          100: '#fef9e7',
          200: '#fdf3d4'
        },
        // Aliases legados — mantidos pra compatibilidade dos componentes
        lime: { 400: '#22c55e', 500: '#16a34a' },
        sun:  { 400: '#fbbf24', 500: '#f59e0b' },
        coral:{ 400: '#ef4444', 500: '#dc2626' }
      },
      boxShadow: {
        glow:    '0 0 0 1px rgba(220,38,38,0.30), 0 10px 40px -10px rgba(220,38,38,0.45)',
        glowGold:'0 0 0 1px rgba(251,191,36,0.30), 0 10px 40px -10px rgba(251,191,36,0.50)',
        card:    '0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 50px -20px rgba(0,0,0,0.7)',
        trophy:  '0 0 60px -10px rgba(251,191,36,0.55)'
      },
      backgroundImage: {
        'grain': "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        'tricolor': 'linear-gradient(90deg, #1d4ed8 0%, #1d4ed8 33%, #dc2626 33%, #dc2626 66%, #16a34a 66%, #16a34a 100%)',
        'tricolor-soft': 'linear-gradient(135deg, rgba(29,78,216,0.18) 0%, rgba(220,38,38,0.18) 50%, rgba(22,163,74,0.18) 100%)',
        'gold-shine': 'linear-gradient(135deg, #fde68a 0%, #fbbf24 40%, #d97706 100%)'
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        shimmer: 'shimmer 6s linear infinite'
      }
    }
  },
  plugins: []
};
