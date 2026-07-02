import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './app.vue',
    './components/**/*.vue',
    './data/**/*.ts',
    './types/**/*.ts'
  ],
  theme: {
    extend: {
      colors: {
        atlas: {
          canvas: 'rgb(var(--atlas-canvas) / <alpha-value>)',
          surface: 'rgb(var(--atlas-surface) / <alpha-value>)',
          rail: 'rgb(var(--atlas-rail) / <alpha-value>)',
          ink: 'rgb(var(--atlas-ink) / <alpha-value>)',
          muted: 'rgb(var(--atlas-muted) / <alpha-value>)',
          subtle: 'rgb(var(--atlas-subtle) / <alpha-value>)',
          border: 'rgb(var(--atlas-border) / <alpha-value>)',
          line: 'rgb(var(--atlas-line) / <alpha-value>)',
          accent: 'rgb(var(--atlas-accent) / <alpha-value>)',
          accentDark: 'rgb(var(--atlas-accent-dark) / <alpha-value>)',
          success: 'rgb(var(--atlas-success) / <alpha-value>)',
          warning: 'rgb(var(--atlas-warning) / <alpha-value>)',
          danger: 'rgb(var(--atlas-danger) / <alpha-value>)',
          info: 'rgb(var(--atlas-info) / <alpha-value>)',
          cyan: 'rgb(var(--atlas-cyan) / <alpha-value>)',
          violet: 'rgb(var(--atlas-violet) / <alpha-value>)'
        }
      },
      borderRadius: {
        atlas: '8px'
      },
      boxShadow: {
        atlas: '0 16px 36px rgb(var(--atlas-shadow) / 0.13)',
        insetLine: 'inset 0 0 0 1px rgb(var(--atlas-border) / 0.86)',
        instrument: '0 12px 26px rgb(var(--atlas-shadow) / 0.12)'
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif'
        ]
      }
    }
  },
  plugins: []
}
