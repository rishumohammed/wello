# Security Architecture & Production Hardening Controls — Wello

This document outlines the security architecture, defense-in-depth controls, threat model, and residual risk register implemented across the Wello platform.

---

## 1. Executive Summary & Threat Model

Wello is an economic command center for self-employed professionals managing personal income, real hourly rates, project proposals, and client billing. Because Wello stores sensitive financial data and personal income metrics, the platform adheres to a zero-trust, privacy-first engineering architecture.

### Primary Threat Vectors Addressed:
- **Unauthorized Financial Snooping**: Unauthenticated or unauthorized access to individual billing rates, invoices, and payment data.
- **Data Tampering & Non-Repudiation**: Unauthorized alteration of admin actions, user statuses, or billing history.
- **Injection Attacks (SQLi, XSS, XXE)**: Malicious input via API parameters, email template variables, or SVG logo uploads.
- **Brute Force & Credential Stuffing**: Automated guessing of 6-digit OTP login codes or DDoS on resource-heavy analytical endpoints.
- **Path Traversal & Storage Insecurity**: Arbitrary file read/write vulnerabilities via logo uploads.
- **Information Leakage**: Internal database error stack traces, unmasked API keys, or raw OTP codes exposed to clients or logs.

---

## 2. Production Security Controls Matrix

| Control Category | Implemented Defense Mechanism | Status |
|---|---|:---:|
| **Input Validation** | Strict Zod schemas (`.strict()`) rejecting unknown fields, bounding string lengths, and validating UUID/ID params on all routes. | ✅ Verified |
| **HTTP Security Headers** | CSP, HSTS (`max-age=31536000; includeSubDomains`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. | ✅ Verified |
| **Distributed Rate Limiting** | Shared MySQL-backed sliding window rate limiter throttling OTP dispatch, login attempts, event ingestion (120 req/min), and data exports. | ✅ Verified |
| **Personal Income Privacy** | Aggregate defaults; individual financial drilldown strictly gated behind `users.financial_view` and mandatory business justification logging. | ✅ Verified |
| **Tamper-Evident Audit Trail** | Cryptographic SHA-256 hash-chained append-only audit trail from Genesis to tip with real-time integrity verification endpoint. | ✅ Verified |
| **Email Template Sanitization** | Automatic HTML entity escaping on all user variable substitutions, tag allowlist sanitization on admin templates, and live preview. | ✅ Verified |
| **Secure File / Logo Uploads** | Magic byte validation, MIME verification, SVG XSS/XXE sanitization, 2MB size cap, and path traversal defense with UUID keys. | ✅ Verified |
| **Structured Observability** | JSON logging with correlation `x-request-id`, user ID, and automated PII/secrets redaction; Sentry error hook; `/api/health` & `/api/ready` probes. | ✅ Verified |
| **Database Performance** | Knex connection pooling with active timeout management; composite indexes on top 20 queries across work sessions, invoices, and events. | ✅ Verified |
| **SSR vs SPA Architecture** | Nuxt routeRules configured: static prerender/SSR for public marketing & invoices, client-side SPA (`ssr: false`) for authenticated workspace. | ✅ Verified |
| **Time-Boxed Support Mode** | Read-only impersonation session (15-min expiry), mandatory reason logging, omnipresent warning banner, and mutation blocking (403). | ✅ Verified |

---

## 3. Detailed Technical Implementation

### A. Input Validation & Parameter Narrowing
- **Strict Schema Enforcement**: All endpoints parse incoming request payloads with Zod schemas. Unknown or unmapped fields are rejected with HTTP 400.
- **Size Bounds**: Maximum lengths on text inputs (e.g. `name: z.string().max(100)`, `email: z.string().max(255)`).
- **Safe Error Masking**: Client responses return sanitized validation messages without leaking internal database column names or execution stack traces.

### B. Distributed Rate Limiting Engine
- **Shared Persistence**: The `rate_limits` table enables multi-instance deployments to enforce global limits without race conditions.
- **Tiered Quotas**:
  - `auth_send_otp`: 5 requests / 5 minutes per identifier
  - `auth_verify_otp`: 10 attempts / 10 minutes per identifier (cleared immediately upon successful verification)
  - `events_ingest`: 120 requests / minute per client session
  - `export_data`: 10 requests / 10 minutes per user
  - `analytics_admin`: 60 requests / minute

### C. Email Template & XSS Defense
- **Variable Escaping**: `escapeHtml()` encodes `&`, `<`, `>`, `"`, `'` on any user-supplied variable (e.g. `customer_name`, `project_name`, `first_name`).
- **Template Sanitization**: Admin template updates strip `<script>`, `<iframe>`, `on*` event handlers, and `javascript:` URLs.
- **Preview Sandbox**: Endpoint `GET /api/admin/email/preview` provides live rendered previews using standard fixture datasets.

### D. File & Logo Upload Protection
- **Magic Byte Inspection**: Verifies binary signatures of PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), and WebP (`52 49 46 46`).
- **SVG Sanitization**: Strips XML entity declarations (`<!ENTITY>`), `<script>` blocks, and embedded payloads.
- **Directory Traversal Immunity**: Filenames are discarded and replaced with random 128-bit hex UUIDs (`logo_{userId}_{hex}.{ext}`); file resolution is constrained strictly within the upload root directory.

### E. Health & Readiness Probes
- **Liveness Probe** (`/api/health`): Returns HTTP 200 with uptime, Node version, and memory allocation metrics.
- **Readiness Probe** (`/api/ready`): Executes `SELECT 1` against the MySQL pool to verify active database connectivity and migration state before accepting user traffic.

### F. SSR vs SPA Architectural Strategy
- **Marketing & Public Pages** (`/`, `/privacy`, `/terms`, `/invoices/public/**`): Prerendered or server-side rendered for SEO, social crawlers, and instant Largest Contentful Paint (LCP).
- **Authenticated App & Admin Panel** (`/timer`, `/dashboard`, `/analytics`, `/store`, `/admin/**`): Configured with `ssr: false` to enable local-first offline synchronization, Pinia state reactivity, and secure browser-side token storage.

---

## 4. Residual Risk Register & Operational Recommendations

| Risk Item | Severity | Current Mitigation | Recommended Next Step for Enterprise Production |
|---|---|---|---|
| **DDoS Attack Volume** | Medium | Server-level rate limiting (`rateLimiter.ts`) | Deploy Cloudflare or AWS CloudFront WAF at DNS edge. |
| **Admin Credential Compromise** | Low | Step-up OTP for sensitive mutations + 4-hour max session lifespan | Enforce FIDO2 / WebAuthn hardware security keys for Super Admins. |
| **Blob Storage Scalability** | Low | Local storage driver with path containment | Configure AWS S3 or Cloudflare R2 bucket with `STORAGE_DRIVER=s3`. |
| **Log Aggregation** | Low | Structured JSON logs formatted for stdout | Pipe container stdout to Datadog, AWS CloudWatch, or Grafana Loki. |
