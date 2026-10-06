// backend/plugins/00.envValidator.ts
import { validateEnvironment } from '../utils/envValidator'

export default defineNitroPlugin(() => {
  const isProd = process.env.NODE_ENV === 'production'
  const validation = validateEnvironment(process.env)

  if (!validation.valid) {
    if (isProd) {
      console.error('[FATAL] Aborting server startup due to critical production configuration violations.')
      throw new Error(`Unsafe production configuration: ${validation.errors.join('; ')}`)
    } else {
      console.warn('[WARN] Configuration warnings detected (allowed in development/test):')
      validation.errors.forEach((err) => console.warn(`  • ${err}`))
    }
  } else {
    console.log(`[Wello Env Validator] Environment configuration verified (${process.env.NODE_ENV || 'development'}).`)
  }
})
