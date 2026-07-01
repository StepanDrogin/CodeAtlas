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
      meta: [
        {
          name: 'description',
          content:
            'AI-ready codebase intelligence platform for GitHub repositories.'
        }
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
