// backend/utils/envValidator.ts
/**
 * Fast-Fail Production-Grade Environment Variable Validator for Wello
 * Validates configuration schema on startup, enforces strict production safety rules,
 * and exports metadata for automated documentation synchronization.
 */

import { z } from 'zod'

export interface EnvVariableMeta {
  key: string
  environment: 'All' | 'Prod/Staging' | 'Optional'
  defaultValue: string
  sensitivity: 'Low' | 'Medium' | 'High'
  purpose: string
}

export const ENV_METADATA_CATALOG: EnvVariableMeta[] = [
  {
    key: 'NODE_ENV',
    environment: 'All',
    defaultValue: '`development`',
    sensitivity: 'Low',
    purpose: 'Runtime execution mode (`development`, `test`, `staging`, `production`).',
  },
  {
    key: 'PORT',
    environment: 'All',
    defaultValue: '`3001`',
    sensitivity: 'Low',
    purpose: 'Backend HTTP listener port.',
  },
  {
    key: 'HOST',
    environment: 'All',
    defaultValue: '`0.0.0.0`',
    sensitivity: 'Low',
    purpose: 'Network interface bind address for incoming traffic.',
  },
  {
    key: 'APP_BASE_URL',
    environment: 'All',
    defaultValue: '`http://localhost:3000`',
    sensitivity: 'Low',
    purpose: 'Public canonical base URL for the Wello frontend application.',
  },
  {
    key: 'DB_HOST',
    environment: 'All',
    defaultValue: '`127.0.0.1`',
    sensitivity: 'Low',
    purpose: 'MySQL relational database host address.',
  },
  {
    key: 'DB_PORT',
    environment: 'All',
    defaultValue: '`3306`',
    sensitivity: 'Low',
    purpose: 'MySQL database listener port.',
  },
  {
    key: 'DB_USER',
    environment: 'All',
    defaultValue: '`wello_user`',
    sensitivity: 'Medium',
    purpose: 'MySQL application user with least-privilege data access (cannot be `root` in prod).',
  },
  {
    key: 'DB_PASSWORD',
    environment: 'All',
    defaultValue: '`""`',
    sensitivity: 'High',
    purpose: 'MySQL application user password (mandatory in production).',
  },
  {
    key: 'DB_NAME',
    environment: 'All',
    defaultValue: '`wello`',
    sensitivity: 'Low',
    purpose: 'MySQL primary database schema name.',
  },
  {
    key: 'DB_MIGRATION_USER',
    environment: 'Prod/Staging',
    defaultValue: '`wello_migrator`',
    sensitivity: 'Medium',
    purpose: 'Dedicated MySQL user with DDL rights for schema migrations.',
  },
  {
    key: 'DB_MIGRATION_PASSWORD',
    environment: 'Prod/Staging',
    defaultValue: '`""`',
    sensitivity: 'High',
    purpose: 'Password for dedicated migration runner user.',
  },
  {
    key: 'DB_POOL_MIN',
    environment: 'All',
    defaultValue: '`2`',
    sensitivity: 'Low',
    purpose: 'Minimum active database connection pool size.',
  },
  {
    key: 'DB_POOL_MAX',
    environment: 'All',
    defaultValue: '`20`',
    sensitivity: 'Low',
    purpose: 'Maximum database connection pool capacity.',
  },
  {
    key: 'REDIS_HOST',
    environment: 'Prod/Staging',
    defaultValue: '`127.0.0.1`',
    sensitivity: 'Low',
    purpose: 'Redis cache, sliding-window rate limiter, and lock host.',
  },
  {
    key: 'REDIS_PORT',
    environment: 'Prod/Staging',
    defaultValue: '`6379`',
    sensitivity: 'Low',
    purpose: 'Redis service port.',
  },
  {
    key: 'REDIS_PASSWORD',
    environment: 'Prod/Staging',
    defaultValue: '`""` (Required in Prod)',
    sensitivity: 'High',
    purpose: 'Redis authentication password (mandatory in production).',
  },
  {
    key: 'REDIS_TLS',
    environment: 'Prod/Staging',
    defaultValue: '`false`',
    sensitivity: 'Low',
    purpose: 'Enable TLS/SSL encryption for Redis connections.',
  },
  {
    key: 'SESSION_SECRET',
    environment: 'All',
    defaultValue: 'Required in Prod',
    sensitivity: 'High',
    purpose: 'Secret key for signing and encrypting browser session cookies.',
  },
  {
    key: 'AUTH_HMAC_SECRET',
    environment: 'All',
    defaultValue: 'Required in Prod (>=32 chars)',
    sensitivity: 'High',
    purpose: 'Secret key for OTP code salting and bearer session token hashing.',
  },
  {
    key: 'AUDIT_HMAC_SECRET',
    environment: 'All',
    defaultValue: 'Required in Prod (>=32 chars)',
    sensitivity: 'High',
    purpose: 'Secret key for tamper-evident cryptographic audit chain hashing.',
  },
  {
    key: 'ALLOW_DEV_AUTH',
    environment: 'All',
    defaultValue: '`false`',
    sensitivity: 'High',
    purpose: 'Allows deterministic dev OTP bypass in local tests (strictly rejected in prod).',
  },
  {
    key: 'ALLOWED_ORIGINS',
    environment: 'All',
    defaultValue: '`http://localhost:3000`',
    sensitivity: 'Medium',
    purpose: 'Comma-separated CORS allowed origins (wildcard `*` rejected with credentials).',
  },
  {
    key: 'TRUST_PROXY',
    environment: 'All',
    defaultValue: '`true`',
    sensitivity: 'Low',
    purpose: 'Trust reverse proxy `X-Forwarded-For` headers for client IP resolution.',
  },
  {
    key: 'VAPID_PUBLIC_KEY',
    environment: 'Prod/Staging',
    defaultValue: 'Optional in Dev',
    sensitivity: 'Low',
    purpose: 'Public key for RFC 8292 Web Push notifications application server.',
  },
  {
    key: 'VAPID_PRIVATE_KEY',
    environment: 'Prod/Staging',
    defaultValue: 'Optional in Dev',
    sensitivity: 'High',
    purpose: 'Private signing key for Web Push notification payload delivery.',
  },
  {
    key: 'VAPID_SUBJECT',
    environment: 'Prod/Staging',
    defaultValue: '`mailto:admin@wello.app`',
    sensitivity: 'Low',
    purpose: 'Contact mailto URI or URL sent in push subscription claims.',
  },
  {
    key: 'BACKUP_ENCRYPTION_KEY',
    environment: 'Prod/Staging',
    defaultValue: 'Required for Prod Backups',
    sensitivity: 'High',
    purpose: 'AES-256-GCM symmetric passphrase for offsite database backup encryption.',
  },
  {
    key: 'FX_PROVIDER',
    environment: 'All',
    defaultValue: '`frankfurter`',
    sensitivity: 'Low',
    purpose: 'Primary FX provider (`frankfurter`, `exchangerate-api`, `openexchangerates`).',
  },
  {
    key: 'FX_API_KEY',
    environment: 'Prod/Staging',
    defaultValue: 'Optional',
    sensitivity: 'High',
    purpose: 'Commercial API key for wide-coverage foreign exchange rates.',
  },
  {
    key: 'FX_FALLBACK_PROVIDERS',
    environment: 'All',
    defaultValue: '`frankfurter,fixed_pegs`',
    sensitivity: 'Low',
    purpose: 'Comma-separated ordered fallback chain for FX rate resolution.',
  },
  {
    key: 'STORAGE_DRIVER',
    environment: 'All',
    defaultValue: '`local`',
    sensitivity: 'Low',
    purpose: 'Storage driver for brand assets & receipts (`local` or `s3`).',
  },
  {
    key: 'STORAGE_LOCAL_DIR',
    environment: 'All',
    defaultValue: '`./uploads`',
    sensitivity: 'Low',
    purpose: 'Local filesystem uploads folder when STORAGE_DRIVER=`local`.',
  },
  {
    key: 'S3_REGION',
    environment: 'Prod/Staging',
    defaultValue: '`us-east-1`',
    sensitivity: 'Low',
    purpose: 'AWS region or cloud object storage region for S3 uploads and backups.',
  },
  {
    key: 'S3_BUCKET',
    environment: 'Prod/Staging',
    defaultValue: '`wello-uploads`',
    sensitivity: 'Low',
    purpose: 'S3 bucket name for invoice attachments, logos, and encrypted backups.',
  },
  {
    key: 'S3_ACCESS_KEY_ID',
    environment: 'Prod/Staging',
    defaultValue: 'Optional in Dev',
    sensitivity: 'High',
    purpose: 'Access key identifier for S3 object storage.',
  },
  {
    key: 'S3_SECRET_ACCESS_KEY',
    environment: 'Prod/Staging',
    defaultValue: 'Optional in Dev',
    sensitivity: 'High',
    purpose: 'Secret access key for S3 object storage.',
  },
  {
    key: 'S3_ENDPOINT',
    environment: 'Prod/Staging',
    defaultValue: 'Optional (MinIO/R2)',
    sensitivity: 'Low',
    purpose: 'Custom S3-compatible endpoint URL for Cloudflare R2, MinIO, or Wasabi.',
  },
  {
    key: 'AUDIT_ANCHOR_SINK',
    environment: 'All',
    defaultValue: '`local_file`',
    sensitivity: 'Low',
    purpose: 'Destination sink for off-database audit anchors (`local_file`, `s3`, `webhook`).',
  },
  {
    key: 'AUDIT_ANCHOR_DESTINATION',
    environment: 'All',
    defaultValue: '`./backups/audit_anchors.log`',
    sensitivity: 'Low',
    purpose: 'Filesystem path or endpoint URL for periodic audit anchor commitments.',
  },
  {
    key: 'AUDIT_ANCHOR_API_KEY',
    environment: 'Optional',
    defaultValue: '`""`',
    sensitivity: 'High',
    purpose: 'Authentication secret for external audit anchor sink destination.',
  },
  {
    key: 'RESEND_API_KEY',
    environment: 'Prod/Staging',
    defaultValue: 'Optional in Dev',
    sensitivity: 'High',
    purpose: 'API key for transactional email dispatch via Resend.',
  },
  {
    key: 'RESEND_FROM_EMAIL',
    environment: 'All',
    defaultValue: '`onboarding@resend.dev`',
    sensitivity: 'Low',
    purpose: 'Verified sender email address for transactional communications.',
  },
  {
    key: 'RESEND_FROM_NAME',
    environment: 'All',
    defaultValue: '`Wello`',
    sensitivity: 'Low',
    purpose: 'Sender display name for transactional emails.',
  },
  {
    key: 'RESEND_WEBHOOK_SECRET',
    environment: 'Prod/Staging',
    defaultValue: 'Optional in Dev',
    sensitivity: 'High',
    purpose: '`svix-signature` HMAC signing key for delivery webhook verification.',
  },
  {
    key: 'TWILIO_ACCOUNT_SID',
    environment: 'Prod/Staging',
    defaultValue: 'Optional in Dev',
    sensitivity: 'High',
    purpose: 'Twilio account SID for SMS OTP delivery.',
  },
  {
    key: 'TWILIO_AUTH_TOKEN',
    environment: 'Prod/Staging',
    defaultValue: 'Optional in Dev',
    sensitivity: 'High',
    purpose: 'Twilio authentication token for SMS dispatch.',
  },
  {
    key: 'TWILIO_PHONE_NUMBER',
    environment: 'Prod/Staging',
    defaultValue: 'Optional in Dev',
    sensitivity: 'Medium',
    purpose: 'Twilio verified sender phone number in E.164 format.',
  },
  {
    key: 'SENTRY_DSN',
    environment: 'Prod/Staging',
    defaultValue: 'Optional in Dev',
    sensitivity: 'Medium',
    purpose: 'Sentry application monitoring and crash reporting DSN.',
  },
  {
    key: 'ALERT_WEBHOOK_URL',
    environment: 'Prod/Staging',
    defaultValue: 'Optional in Dev',
    sensitivity: 'Medium',
    purpose: 'Webhook endpoint for critical system health and scheduler alerts.',
  },
  {
    key: 'ADMIN_IP_ALLOWLIST',
    environment: 'Prod/Staging',
    defaultValue: 'Empty (Disabled)',
    sensitivity: 'Medium',
    purpose: 'Comma-separated IP addresses/CIDRs allowed to access admin routes.',
  },
]

const KNOWN_WEAK_SECRETS = new Set([
  'wello_auth_hmac_secret_2025_dev_key',
  'wello-audit-hmac-sha256-secret-key-production-2026',
  'replace_with_64_char_secure_random_hex_string',
  'secret',
  'password',
  '12345678',
  'changeme',
])

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production', 'staging']).default('development'),
  PORT: z.string().or(z.number()).default(3001),
  HOST: z.string().default('0.0.0.0'),
  APP_BASE_URL: z.string().default('http://localhost:3000'),

  // Database Connection
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.string().or(z.number()).default(3306),
  DB_USER: z.string().default('wello_user'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('wello'),
  DB_MIGRATION_USER: z.string().optional().default(''),
  DB_MIGRATION_PASSWORD: z.string().optional().default(''),
  DB_POOL_MIN: z.string().or(z.number()).default(2),
  DB_POOL_MAX: z.string().or(z.number()).default(20),

  // Redis & Caching
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.string().or(z.number()).default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_TLS: z.string().or(z.boolean()).default(false),

  // Security & Secrets
  SESSION_SECRET: z.string().optional().default(''),
  AUTH_HMAC_SECRET: z.string().optional().default(''),
  AUDIT_HMAC_SECRET: z.string().optional().default(''),
  ALLOW_DEV_AUTH: z.string().or(z.boolean()).optional().default(false),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000'),
  CORS_ORIGIN: z.string().optional(),
  TRUST_PROXY: z.string().or(z.boolean()).default(true),

  // Push Notifications (VAPID)
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().optional().default('mailto:admin@wello.app'),

  // Backups & Disaster Recovery
  BACKUP_ENCRYPTION_KEY: z.string().optional().default(''),

  // FX Rates
  FX_PROVIDER: z.string().default('frankfurter'),
  FX_API_KEY: z.string().optional().default(''),
  FX_FALLBACK_PROVIDERS: z.string().default('frankfurter,fixed_pegs'),

  // Storage
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('wello-uploads'),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  S3_ENDPOINT: z.string().optional().default(''),

  // Audit Anchor Sink
  AUDIT_ANCHOR_SINK: z.enum(['local_file', 's3', 'webhook', 'none']).default('local_file'),
  AUDIT_ANCHOR_DESTINATION: z.string().default('./backups/audit_anchors.log'),
  AUDIT_ANCHOR_API_KEY: z.string().optional().default(''),

  // Third-Party Integrations
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_FROM_EMAIL: z.string().optional().default('onboarding@resend.dev'),
  RESEND_FROM_NAME: z.string().optional().default('Wello'),
  RESEND_WEBHOOK_SECRET: z.string().optional().default(''),
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_PHONE_NUMBER: z.string().optional().default(''),
  SENTRY_DSN: z.string().optional().default(''),
  ALERT_WEBHOOK_URL: z.string().optional().default(''),
  ADMIN_IP_ALLOWLIST: z.string().optional().default(''),
})

export type ValidatedEnv = z.infer<typeof envSchema>

export interface ValidationResult {
  valid: boolean
  errors: string[]
  data?: ValidatedEnv
}

/**
 * Validates configuration and enforces non-negotiable production security constraints.
 */
export function validateEnvironment(env: Record<string, any> = process.env): ValidationResult {
  const result = envSchema.safeParse(env)
  const errors: string[] = []

  if (!result.success) {
    result.error.errors.forEach((err) => {
      errors.push(`[${err.path.join('.')}] - ${err.message}`)
    })
  }

  const nodeEnv = (env.NODE_ENV || 'development').trim().toLowerCase()
  const isProd = nodeEnv === 'production'

  if (isProd) {
    // 1. DB_USER cannot be root
    const dbUser = (env.DB_USER || '').trim()
    if (!dbUser || dbUser.toLowerCase() === 'root') {
      errors.push("Production security violation: DB_USER cannot be 'root'. Use a least-privilege application user (e.g. 'wello_app').")
    }

    // 2. DB_PASSWORD cannot be empty
    const dbPass = (env.DB_PASSWORD || '').trim()
    if (!dbPass) {
      errors.push('Production security violation: DB_PASSWORD cannot be empty.')
    }

    // 3. AUTH_HMAC_SECRET must be strong (>= 32 chars and not default)
    const authSecret = (env.AUTH_HMAC_SECRET || '').trim()
    if (!authSecret || authSecret.length < 32 || KNOWN_WEAK_SECRETS.has(authSecret)) {
      errors.push('Production security violation: AUTH_HMAC_SECRET must be set, at least 32 characters long, and not a known default placeholder.')
    }

    // 4. AUDIT_HMAC_SECRET must be strong (>= 32 chars and not default)
    const auditSecret = (env.AUDIT_HMAC_SECRET || '').trim()
    if (!auditSecret || auditSecret.length < 32 || KNOWN_WEAK_SECRETS.has(auditSecret)) {
      errors.push('Production security violation: AUDIT_HMAC_SECRET must be set, at least 32 characters long, and not a known default placeholder.')
    }

    // 5. ALLOW_DEV_AUTH must not be set or true
    const allowDevAuth = String(env.ALLOW_DEV_AUTH || '').trim().toLowerCase()
    if (allowDevAuth === 'true' || allowDevAuth === '1' || allowDevAuth === 'yes') {
      errors.push('Production security violation: ALLOW_DEV_AUTH is strictly prohibited in production mode.')
    }

    // 6. REDIS_PASSWORD must be provided
    const redisPass = (env.REDIS_PASSWORD || '').trim()
    if (!redisPass) {
      errors.push('Production security violation: REDIS_PASSWORD is required in production.')
    }

    // 7. CORS wildcard check: ALLOWED_ORIGINS / CORS_ORIGIN cannot contain '*' with credentials
    const corsOrigins = (env.ALLOWED_ORIGINS || env.CORS_ORIGIN || '').split(',').map((s: string) => s.trim())
    if (corsOrigins.some((origin: string) => origin === '*')) {
      errors.push("Production security violation: CORS/ALLOWED_ORIGINS cannot allow wildcard '*' when session credentials are enabled.")
    }
  }

  if (errors.length > 0) {
    if (isProd) {
      console.error('\n🚨 FATAL CONFIGURATION ERROR: Server refused to start in production due to unsafe configuration:')
      errors.forEach((err) => console.error(`  ❌ ${err}`))
      console.error('\nPlease correct the environment variables in your deployment before restarting.\n')
    }
    return { valid: false, errors, data: result.success ? result.data : undefined }
  }

  return { valid: true, errors: [], data: result.data }
}

/**
 * Generates the Markdown Environment Matrix table for ARCHITECTURE.md directly from metadata.
 */
export function generateEnvMatrixMarkdown(): string {
  const rows = [
    '| Variable | Environment | Default / Fallback | Sensitivity | Purpose |',
    '| :--- | :--- | :--- | :---: | :--- |',
  ]

  for (const meta of ENV_METADATA_CATALOG) {
    rows.push(`| \`${meta.key}\` | ${meta.environment} | ${meta.defaultValue} | ${meta.sensitivity} | ${meta.purpose} |`)
  }

  return rows.join('\n')
}
