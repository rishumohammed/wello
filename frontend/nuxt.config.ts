// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  modules: [
    '@pinia/nuxt',
    '@vueuse/nuxt',
  ],
  css: ['~/assets/css/main.css'],
  routeRules: {
    // Proxy all /api requests to the standalone backend server
    '/api/**': {
      proxy: process.env.BACKEND_API_URL || 'http://localhost:3001/api/**',
    },
  },
  runtimeConfig: {
    public: {
      appName: 'Wello',
      appVersion: '1.0.0',
      currencySymbol: process.env.CURRENCY_SYMBOL || '₹',
      apiBaseUrl: process.env.BACKEND_API_URL || 'http://localhost:3001/api',
    }
  },
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' },
    head: {
      title: 'Wello – Work Value & Income Management',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'Wello helps self-employed professionals understand the real economic value of their time across every project, client, and hour worked.'
        },
        { name: 'theme-color', content: '#FF9F1C' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
        },
        { rel: 'icon', type: 'image/png', href: '/logo.png' }
      ]
    }
  }
})
