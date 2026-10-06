// backend/tests/test_env_validation_and_startup_safety.mjs
/**
 * Test Suite: Production Environment Validation & Fast-Fail Startup Safety
 * Verifies that the Zod schema rejects insecure production configurations:
 *  - DB_USER is root
 *  - DB_PASSWORD is empty
 *  - AUTH_HMAC_SECRET or AUDIT_HMAC_SECRET is missing or weak (<32 chars / default)
 *  - ALLOW_DEV_AUTH is set / true
 *  - REDIS_PASSWORD is missing
 *  - CORS allows wildcard '*' with credentials
 */

import { validateEnvironment } from '../utils/envValidator.ts'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${message}`)
    failed++
  }
}

console.log('\n===============================================================')
console.log('🧪 RUNNING PRODUCTION CONFIGURATION & STARTUP SAFETY TESTS')
console.log('===============================================================\n')

const BASE_VALID_PROD_ENV = {
  NODE_ENV: 'production',
  PORT: '3001',
  APP_BASE_URL: 'https://wello.app',
  DB_HOST: '10.0.0.5',
  DB_PORT: '3306',
  DB_USER: 'wello_app',
  DB_PASSWORD: 'SuperStrongProductionDbPassword987!#',
  DB_NAME: 'wello',
  REDIS_HOST: '10.0.0.6',
  REDIS_PORT: '6379',
  REDIS_PASSWORD: 'SuperSecureRedisPassword2026!#',
  SESSION_SECRET: 'a_very_secure_session_secret_for_production_use_only_64_bytes_long',
  AUTH_HMAC_SECRET: 'auth_hmac_secret_key_that_is_at_least_32_characters_long_for_prod',
  AUDIT_HMAC_SECRET: 'audit_hmac_secret_key_that_is_at_least_32_characters_long_for_prod',
  ALLOW_DEV_AUTH: 'false',
  ALLOWED_ORIGINS: 'https://wello.app,https://admin.wello.app',
  BACKUP_ENCRYPTION_KEY: 'wello_secure_backup_encryption_passphrase_production_2026',
}

// Test 1: Valid production config passes
console.log('Test Group 1: Valid Production Configuration')
const validRes = validateEnvironment(BASE_VALID_PROD_ENV)
assert(validRes.valid === true && validRes.errors.length === 0, 'Valid production environment passes validation')

// Test 2: In production, DB_USER === 'root' is rejected
console.log('\nTest Group 2: DB_USER Root Rejection in Production')
const rootUserRes = validateEnvironment({ ...BASE_VALID_PROD_ENV, DB_USER: 'root' })
assert(rootUserRes.valid === false, 'Rejects DB_USER=root in production')
assert(rootUserRes.errors.some(e => e.includes('DB_USER cannot be \'root\'')), 'Contains specific DB_USER error message')

// Test 3: In production, DB_PASSWORD empty is rejected
console.log('\nTest Group 3: Empty DB_PASSWORD Rejection in Production')
const emptyPassRes = validateEnvironment({ ...BASE_VALID_PROD_ENV, DB_PASSWORD: '' })
assert(emptyPassRes.valid === false, 'Rejects empty DB_PASSWORD in production')
assert(emptyPassRes.errors.some(e => e.includes('DB_PASSWORD cannot be empty')), 'Contains specific DB_PASSWORD error message')

// Test 4: In production, weak AUTH_HMAC_SECRET is rejected
console.log('\nTest Group 4: Weak or Missing AUTH_HMAC_SECRET')
const shortAuthSecretRes = validateEnvironment({ ...BASE_VALID_PROD_ENV, AUTH_HMAC_SECRET: 'short_key_123' })
assert(shortAuthSecretRes.valid === false, 'Rejects AUTH_HMAC_SECRET with <32 characters')
const defaultAuthSecretRes = validateEnvironment({ ...BASE_VALID_PROD_ENV, AUTH_HMAC_SECRET: 'wello_auth_hmac_secret_2025_dev_key' })
assert(defaultAuthSecretRes.valid === false, 'Rejects default dev placeholder for AUTH_HMAC_SECRET')

// Test 5: In production, weak AUDIT_HMAC_SECRET is rejected
console.log('\nTest Group 5: Weak or Missing AUDIT_HMAC_SECRET')
const shortAuditSecretRes = validateEnvironment({ ...BASE_VALID_PROD_ENV, AUDIT_HMAC_SECRET: 'short' })
assert(shortAuditSecretRes.valid === false, 'Rejects AUDIT_HMAC_SECRET with <32 characters')
const defaultAuditSecretRes = validateEnvironment({ ...BASE_VALID_PROD_ENV, AUDIT_HMAC_SECRET: 'wello-audit-hmac-sha256-secret-key-production-2026' })
assert(defaultAuditSecretRes.valid === false, 'Rejects default dev placeholder for AUDIT_HMAC_SECRET')

// Test 6: In production, ALLOW_DEV_AUTH=true is rejected
console.log('\nTest Group 6: ALLOW_DEV_AUTH Rejection in Production')
const devAuthRes = validateEnvironment({ ...BASE_VALID_PROD_ENV, ALLOW_DEV_AUTH: 'true' })
assert(devAuthRes.valid === false, 'Rejects ALLOW_DEV_AUTH=true in production')
assert(devAuthRes.errors.some(e => e.includes('ALLOW_DEV_AUTH is strictly prohibited')), 'Contains ALLOW_DEV_AUTH error message')

// Test 7: In production, missing REDIS_PASSWORD is rejected
console.log('\nTest Group 7: Missing REDIS_PASSWORD')
const noRedisPassRes = validateEnvironment({ ...BASE_VALID_PROD_ENV, REDIS_PASSWORD: '' })
assert(noRedisPassRes.valid === false, 'Rejects missing REDIS_PASSWORD in production')
assert(noRedisPassRes.errors.some(e => e.includes('REDIS_PASSWORD is required')), 'Contains REDIS_PASSWORD error message')

// Test 8: In production, CORS wildcard with credentials is rejected
console.log('\nTest Group 8: CORS Wildcard Rejection')
const corsWildcardRes = validateEnvironment({ ...BASE_VALID_PROD_ENV, ALLOWED_ORIGINS: '*' })
assert(corsWildcardRes.valid === false, 'Rejects wildcard CORS origin \'*\' in production')
assert(corsWildcardRes.errors.some(e => e.includes('CORS/ALLOWED_ORIGINS cannot allow wildcard')), 'Contains wildcard CORS error message')

// Test 9: Development mode allows lenient settings
console.log('\nTest Group 9: Development Mode Permissiveness')
const devEnvRes = validateEnvironment({
  NODE_ENV: 'development',
  DB_USER: 'root',
  DB_PASSWORD: '',
  ALLOW_DEV_AUTH: 'true',
})
assert(devEnvRes.valid === true, 'Allows root DB user and dev auth in development mode')

console.log('\n===============================================================')
console.log(`📊 RESULTS: ${passed} PASSED, ${failed} FAILED`)
console.log('===============================================================\n')

if (failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
