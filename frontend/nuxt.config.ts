// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },
  experimental: {
    appManifest: false,
  },
  modules: [
    '@pinia/nuxt',
    '@vueuse/nuxt',
  ],
  css: ['~/assets/css/main.css'],
  routeRules: {
    // Marketing & public informational pages (Prerender / SSR for SEO, OpenGraph & fast paint)
    '/': { prerender: true },
    '/privacy': { prerender: true },
    '/terms': { prerender: true },
    '/invoices/public/**': { ssr: true },
    '/quotes/public/**': { ssr: true },

    // Authenticated application routes & admin workspace (Client-side SPA for offline sync & state)
    '/admin/**': { ssr: false },
    '/settings/**': { ssr: false },
    '/timer/**': { ssr: false },
    '/analytics/**': { ssr: false },
    '/store/**': { ssr: false },
    '/reports/**': { ssr: false },
    '/app/**': { ssr: false },

    // Proxy all /api requests to the standalone backend server
    '/api/**': {
      proxy: process.env.BACKEND_API_URL || 'http://localhost:3001/api/**',
    },
  },
  runtimeConfig: {
    public: {
      appName: 'Wello',
      appVersion: '1.0.0',
      currencySymbol: process.env.CURRENCY_SYMBOL || '$',
      apiBaseUrl: process.env.BACKEND_API_URL || 'http://localhost:3001/api',
    }
  },
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' },
    head: {
      title: 'Wello – Dual Hourly Rate & Value Manager',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        {
          name: 'description',
          content: 'Wello helps self-employed professionals understand the real economic value of their time across every project, client, and hour worked.'
        },
        { name: 'theme-color', content: '#FF9F1C' },
        { name: 'background-color', content: '#FAFAFC' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Wello' },
        { name: 'application-name', content: 'Wello' },
        { name: 'format-detection', content: 'telephone=no' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
        },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', href: '/icons/icon-192x192.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'apple-touch-icon', sizes: '192x192', href: '/icons/icon-192x192.png' },
      ]
    }
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@vueuse') || id.includes('pinia')) {
                return 'vendor-core'
              }
              if (id.includes('dayjs')) {
                return 'vendor-date'
              }
            }
          }
        }
      }
    }
  }
})
