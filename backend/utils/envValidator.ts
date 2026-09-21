// backend/utils/envValidator.ts
/**
 * Fast-Fail Environment Variable Validator for Wello
 * Validates configuration schema on startup and aborts execution with actionable error messages if invalid.
 */

import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production', 'staging']).default('development'),
  PORT: z.string().or(z.number()).default(3001),
  
  // Database Connection
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.string().or(z.number()).default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('wello'),
  DB_POOL_MIN: z.string().or(z.number()).default(2),
  DB_POOL_MAX: z.string().or(z.number()).default(20),

  // Application & Regional Defaults
  CURRENCY_SYMBOL: z.string().default('$'),
  DEFAULT_COUNTRY: z.string().length(2).default('US'),
  DEFAULT_TIMEZONE: z.string().default('UTC'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // Security & Storage
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_BUCKET: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  
  // Third-Party Integrations (Optional)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional().default('onboarding@resend.dev'),
  RESEND_FROM_NAME: z.string().optional().default('Wello'),
  SENTRY_DSN: z.string().optional(),
  REDIS_URL: z.string().optional(),
})

export type ValidatedEnv = z.infer<typeof envSchema>

export function validateEnvironment(env: Record<string, any> = process.env): ValidatedEnv {
  const result = envSchema.safeParse(env)

  if (!result.success) {
    console.error('\n❌ FATAL CONFIGURATION ERROR: Invalid environment variables detected on startup:\n')
    result.error.errors.forEach((err) => {
      console.error(`  • [${err.path.join('.')}] - ${err.message}`)
    })
    console.error('\nPlease verify your .env file matches .env.example before restarting.\n')
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  }

  return result.success ? result.data : (env as any)
}

// Run validation on import
export const validatedEnv = validateEnvironment()
