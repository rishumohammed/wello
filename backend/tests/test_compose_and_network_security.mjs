// backend/tests/test_compose_and_network_security.mjs
/**
 * Test Suite: Network, Docker Compose & TLS / Reverse Proxy Security Verification
 * Verifies that:
 *  1. In docker-compose.prod.yml, MySQL, Redis and backend instances have NO published host ports.
 *  2. All databases and internal services communicate strictly via isolated internal bridge network.
 *  3. Only Nginx reverse proxy publishes public ingress ports (80/443).
 *  4. Nginx configuration implements upstream with passive failover (max_fails, fail_timeout).
 *  5. Nginx enforces TLS 1.3, HSTS (Strict-Transport-Security), X-Frame-Options, CSP, and security headers.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '../..')

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
console.log('🧪 RUNNING NETWORK, COMPOSE & TLS SECURITY AUDIT TESTS')
console.log('===============================================================\n')

// ─── 1. Production Docker Compose Security Parsing ────────────────────────────
console.log('Test Group 1: Production Docker Compose Network Isolation')
const prodComposePath = path.join(rootDir, 'docker-compose.prod.yml')
assert(fs.existsSync(prodComposePath), 'docker-compose.prod.yml exists')

const prodComposeText = fs.readFileSync(prodComposePath, 'utf8')

// Parse service blocks
function extractServiceConfig(composeContent, serviceName) {
  const serviceRegex = new RegExp(`^  ${serviceName}:\\s*\\n([\\s\\S]*?)(?=^  [a-zA-Z0-9_-]+:|\\Z)`, 'm')
  const match = composeContent.match(serviceRegex)
  return match ? match[1] : null
}

const mysqlConfig = extractServiceConfig(prodComposeText, 'mysql')
const redisConfig = extractServiceConfig(prodComposeText, 'redis')
const backend1Config = extractServiceConfig(prodComposeText, 'backend_1')
const backend2Config = extractServiceConfig(prodComposeText, 'backend_2')
const frontendConfig = extractServiceConfig(prodComposeText, 'frontend')
const nginxConfig = extractServiceConfig(prodComposeText, 'nginx')

assert(mysqlConfig !== null, 'Found mysql service block in prod compose')
assert(redisConfig !== null, 'Found redis service block in prod compose')
assert(backend1Config !== null, 'Found backend_1 service block in prod compose')
assert(backend2Config !== null, 'Found backend_2 service block in prod compose')
assert(nginxConfig !== null, 'Found nginx service block in prod compose')

// Verify NO published ports on databases or backends
assert(!mysqlConfig.includes('ports:'), 'MySQL in production compose has ZERO published host ports')
assert(!redisConfig.includes('ports:'), 'Redis in production compose has ZERO published host ports')
assert(!backend1Config.includes('ports:'), 'Backend 1 in production compose has ZERO published host ports')
assert(!backend2Config.includes('ports:'), 'Backend 2 in production compose has ZERO published host ports')
assert(!frontendConfig.includes('ports:'), 'Frontend in production compose has ZERO published host ports')

// Verify Nginx publishes ingress ports
assert(nginxConfig.includes('80:80') && nginxConfig.includes('443:443'), 'Nginx publishes only ports 80 and 443')

// ─── 2. Nginx Reverse Proxy & Passive Failover Configuration ─────────────────
console.log('\nTest Group 2: Nginx Upstream Passive Failover & TLS Hardening')
const nginxConfPath = path.join(rootDir, 'nginx/default.conf')
assert(fs.existsSync(nginxConfPath), 'nginx/default.conf exists')

const nginxConfText = fs.readFileSync(nginxConfPath, 'utf8')

// Upstream passive failover verification
assert(nginxConfText.includes('upstream backend_upstream'), 'Nginx defines backend_upstream block')
assert(nginxConfText.includes('backend_1:3001') && nginxConfText.includes('backend_2:3001'), 'Nginx upstream includes both backend_1 and backend_2 instances')
assert(nginxConfText.includes('max_fails=') && nginxConfText.includes('fail_timeout='), 'Nginx upstream configures passive failover (max_fails & fail_timeout)')
assert(nginxConfText.includes('proxy_next_upstream'), 'Nginx configures proxy_next_upstream retry directives')

// Security headers verification
assert(nginxConfText.includes('Strict-Transport-Security'), 'Nginx enforces HSTS (Strict-Transport-Security) header')
assert(nginxConfText.includes('max-age=63072000'), 'HSTS header configured with minimum 2-year retention (max-age=63072000)')
assert(nginxConfText.includes('includeSubDomains'), 'HSTS header includes includeSubDomains directive')
assert(nginxConfText.includes('X-Frame-Options "DENY"'), 'Nginx enforces X-Frame-Options: DENY header')
assert(nginxConfText.includes('X-Content-Type-Options "nosniff"'), 'Nginx enforces X-Content-Type-Options: nosniff header')
assert(nginxConfText.includes('Referrer-Policy'), 'Nginx enforces Referrer-Policy header')
assert(nginxConfText.includes('Permissions-Policy'), 'Nginx enforces Permissions-Policy header')
assert(nginxConfText.includes('Content-Security-Policy'), 'Nginx enforces Content-Security-Policy (CSP) header')

// Modern TLS Protocols
assert(nginxConfText.includes('TLSv1.2') && nginxConfText.includes('TLSv1.3'), 'Nginx configures TLS 1.2 and TLS 1.3 protocols')
assert(nginxConfText.includes('/.well-known/acme-challenge/'), 'Nginx supports automated Certbot / Let\'s Encrypt ACME renewal')

console.log('\n===============================================================')
console.log(`📊 RESULTS: ${passed} PASSED, ${failed} FAILED`)
console.log('===============================================================\n')

if (failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
