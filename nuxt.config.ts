// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  srcDir: 'frontend/',
  serverDir: 'backend/',
  dir: {
    public: 'public',
  },
  compatibilityDate: '2024-04-03',
  modules: [
    '@pinia/nuxt',
    '@vueuse/nuxt',
  ],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    // Private server-side config
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: process.env.DB_PORT || '3306',
    dbUser: process.env.DB_USER || 'root',
    dbPassword: process.env.DB_PASSWORD || '',
    dbName: process.env.DB_NAME || 'wello',
    // Public config
    public: {
      appName: 'Wello',
      appVersion: '1.0.0',
      currencySymbol: process.env.CURRENCY_SYMBOL || '₹',
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
  },
  nitro: {
    experimental: {
      wasm: true
    }
  }
})
