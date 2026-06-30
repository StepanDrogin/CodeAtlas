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
          canvas: '#f7f9fb',
          surface: '#ffffff',
          rail: '#eef7f5',
          ink: '#121826',
          muted: '#667085',
          subtle: '#98a2b3',
          border: '#dce3ea',
          line: '#e7edf3',
          accent: '#007a68',
          accentDark: '#005b4f',
          success: '#12b76a',
          warning: '#f79009',
          danger: '#d92d20',
          info: '#2e90fa',
          violet: '#7a5af8'
        }
      },
      borderRadius: {
        atlas: '8px'
      },
      boxShadow: {
        atlas: '0 10px 30px rgba(18, 24, 38, 0.06)',
        insetLine: 'inset 0 0 0 1px rgba(220, 227, 234, 0.9)'
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
