export default defineNuxtConfig({
  compatibilityDate: '2026-06-29',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  experimental: {
    appManifest: false
  },
  runtimeConfig: {
    githubToken: '',
    geminiApiKey: '',
    geminiModel: 'gemini-3.5-flash',
    public: {
      demoMode: false
    }
  },
  build: {
    transpile: ['@codeatlas/analyzer']
  },
  app: {
    head: {
      title: 'CodeAtlas',
      htmlAttrs: {
        lang: 'en'
      },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#007a68' },
        {
          name: 'description',
          content:
            'AI-ready codebase intelligence platform for GitHub repositories.'
        }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.svg' },
        { rel: 'manifest', href: '/site.webmanifest' }
      ]
    }
  },
  tailwindcss: {
    configPath: 'tailwind.config.ts',
    viewer: false
  },
  typescript: {
    strict: true,
    typeCheck: true
  }
})
