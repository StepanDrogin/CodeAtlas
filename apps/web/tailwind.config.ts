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
          canvas: '#f5f8fb',
          surface: '#ffffff',
          rail: '#eaf8f6',
          ink: '#101828',
          muted: '#64748b',
          subtle: '#94a3b8',
          border: '#d8e2ec',
          line: '#edf2f7',
          accent: '#007f78',
          accentDark: '#005f5b',
          success: '#12b76a',
          warning: '#f79009',
          danger: '#d92d20',
          info: '#2e90fa',
          cyan: '#08aeb8',
          violet: '#7a5af8'
        }
      },
      borderRadius: {
        atlas: '8px'
      },
      boxShadow: {
        atlas: '0 18px 45px rgba(16, 24, 40, 0.07)',
        insetLine: 'inset 0 0 0 1px rgba(216, 226, 236, 0.92)',
        instrument: '0 24px 60px rgba(0, 127, 120, 0.16)'
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
