# Wello — Personal Income & Freelance Rate Intelligence Platform

A high-performance, production-hardened platform for freelancers and independent contractors to track actual effective hourly rates, model financial scenarios, manage multi-currency invoicing, and safeguard personal income data.

---

## 🏗️ Architecture & Technology Stack

- **Frontend**: Nuxt 3 (Vue 3, TypeScript, Vite, Server-Side Rendering & Client SPA)
- **Backend**: Nitro / Node.js 20 (REST API, Modular Service Layer, Knex.js ORM, Zod Schema Validation)
- **Database**: MySQL 8.0 (UTF8mb4, Transactional Storage Engine, Multi-Tenant Partitioning, Optimized Indexing)
- **Cache & Rate Limiting**: Redis 7 Alpine (Sliding window rate limiters, token cache, session storage)
- **Reverse Proxy**: Nginx 1.25 Alpine (Unified ingress, SSL termination, HTTP/2, Gzip, static asset caching)
- **Local Email Sandbox**: Mailpit (Zero-external-dependency SMTP server with live browser UI)
- **Security & Observability**: SHA-256 Cryptographic Audit Hash Chain, Dual-Permission Admin Access (`users.view` vs `users.financial_view`), Structured JSON Logging, Sentry Error Tracking, Webhook Alerting Sentinel.

---

## ⚡ 10-Minute Quickstart (Docker Compose)

Get the complete multi-container stack (Database, Cache, Backend, Frontend, Nginx, Mailpit) running locally in under 10 minutes.

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) (v24+) & [Docker Compose](https://docs.docker.com/compose/) (v2+)
- [Git](https://git-scm.com/)

### 2. Clone & Configure Environment
```bash
git clone <repository_url> wello
cd wello

# Copy region-agnostic environment template
cp .env.example .env
```
*(Open `.env` and configure your database passwords and session secret, or use the sensible defaults for local testing)*

### 3. Launch Containers
```bash
docker compose up -d --build
```

### 4. Execute Database Migrations
```bash
docker compose exec backend npx knex migrate:latest --knexfile knexfile.cjs
```

### 5. Access the Stack
| Service | Endpoint | Description |
| :--- | :--- | :--- |
| **Web Application** | [http://localhost](http://localhost) | Unified Nginx entrypoint & Frontend Nuxt 3 UI |
| **Backend API** | [http://localhost/api](http://localhost/api) | Nitro API & Business Logic |
| **Health Liveness Probe** | [http://localhost/api/health](http://localhost/api/health) | System uptime, memory, and status probe |
| **Readiness Probe** | [http://localhost/api/ready](http://localhost/api/ready) | MySQL connection pool probe |
| **Mailpit Web UI** | [http://localhost:8025](http://localhost:8025) | Local inbox to inspect outgoing verification emails & OTPs |

---

## 💻 Manual Local Development (Without Docker)

If you prefer running services directly on your host machine:

### 1. Start MySQL & Redis
Ensure MySQL 8 is running on port `3306` (database `wello`) and Redis is on `6379`.

### 2. Start Backend API Server
```bash
cd backend
npm install
npx knex migrate:latest --knexfile knexfile.cjs
npm run dev
# Backend starts on http://localhost:3001
```

### 3. Start Frontend Web Client
```bash
cd frontend
npm install
npm run dev
# Frontend starts on http://localhost:3000
```

---

## 🚀 Manual Server Deployment (Pull from Git)

When deploying to a production server, deployments are triggered manually via Git pull without requiring external CI/CD pipelines.

### Deployment Workflow
```
[1/6 Git Pull] -> [2/6 DB Snapshot] -> [3/6 Docker Build & Up] -> [4/6 Knex Migration] -> [5/6 Health Probe] -> [6/6 Live]
```

### On Linux / macOS Server:
```bash
chmod +x ./scripts/deploy.sh
./scripts/deploy.sh
```

### On Windows Server (PowerShell):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1
```

### What the Deploy Pipeline Does:
1. **Verifies `.env`**: Aborts immediately if critical production credentials are missing.
2. **Pulls Latest Code**: Fetches latest branch commits cleanly from origin.
3. **Pre-Deployment DB Snapshot**: Automatically dumps current MySQL state into `./backups/pre_deploy_backup_<timestamp>.sql.gz`.
4. **Rebuilds Containers**: Runs `docker compose up -d --build --remove-orphans`.
5. **Applies DB Migrations**: Runs latest Knex migrations inside the backend container.
6. **Probes Health Endpoint**: Pings `/api/health` with retry backoff. If healthy (HTTP 200), marks deployment live.

---

## 🛡️ Database Backups, Disaster Recovery & Restore Drills

Wello includes automated, standalone database backup engines with SHA-256 checksum verification and isolated Disaster Recovery drill capabilities.

### 1. Create a Snapshot Backup
```bash
node ./scripts/db_backup_restore.mjs backup
# or on Linux: ./scripts/backup_restore.sh backup
# or on Windows: .\scripts\backup_restore.ps1 backup
```
- Dumps schema, tables, and rows with multi-row batching.
- Generates a SHA-256 cryptographic verification file (`.sha256`).
- Automatically prunes backups older than 30 days.

### 2. Restore from Backup
```bash
node ./scripts/db_backup_restore.mjs restore ./backups/wello_backup_20260921_215825.sql
```
- Automatically verifies the SHA-256 checksum before execution.
- Restores all tables, constraints, foreign keys, and records.

### 3. Run Automated Disaster Recovery Drill
```bash
node ./scripts/db_backup_restore.mjs drill
```
- Creates a live snapshot of production.
- Spins up an isolated sandbox database (`wello_dr_drill_<timestamp>`).
- Restores the snapshot into the sandbox.
- **Verifies Schema Integrity**: Checks table count, user count, invoice count.
- **Verifies Cryptographic Audit Chain**: Sequentially verifies SHA-256 block linkages across all audit records.
- Tears down the sandbox database and certifies the recovery procedure.

---

## 🧪 Comprehensive Test Suites

Wello is protected by four comprehensive, automated test suites covering pure unit math, end-to-end user lifecycles, production hardening, and financial privacy safety.

```bash
# 1. Pure Unit Tests (Zero Network Dependencies)
node backend/tests/test_unit_suites.mjs

# 2. End-to-End Application Lifecycle Flows
node backend/tests/test_e2e_playwright_flows.mjs

# 3. Production Hardening & Security Defenses
node backend/tests/test_production_hardening.mjs

# 4. Cryptographic Audit Chain & Financial Privacy Safety
node backend/tests/test_audit_chain_and_financial_safety.mjs
```

### Test Coverage Highlights:
- **Metrics Engine**: Dual hourly rate math, effective all-in rate, target rate variance, multi-project blending.
- **Tax & FX**: Inclusive / exclusive VAT/GST, reverse charge cross-border calculation, currency triangulation.
- **Timer & Sessions**: Active timers, pause interval deductions, overlap prevention.
- **Security & Hardening**: Strict Zod schema validation, magic-byte image validation, path traversal defense, sliding window rate limits, CSP / HSTS headers.
- **Privacy & Safety**: Admin permission gates (`users.financial_view` with mandatory justification), unmasked secret protection, SHA-256 tamper-evident audit logs.

---

## 🔐 Security & Privacy Architecture

- **Personal Income Privacy**: Default admin views show aggregated platform statistics. Access to individual financial data (quotes, payments, invoices) strictly requires `users.financial_view` permission and a mandatory text justification.
- **Append-Only Tamper-Proof Audit Chain**: Every administrative view or modification writes a SHA-256 hashed audit block referencing the previous record's hash, forming an immutable cryptographic ledger.
- **No Plaintext Secrets**: Admin API and database views never expose raw OTP codes, session tokens, or unmasked credentials. Session tokens are stored as SHA-256 hashes (`token_hash`).
- **Distributed Rate Limiting**: Redis-backed and database-backed rate limiters enforce throttling on `/api/auth/*`, `/api/otp/*`, `/api/analytics/*`, and `/api/events/*`.
- **System Failure Alert Dispatcher**: Integrated alert engine (`backend/utils/alertEngine.ts`) sends critical failure and security alerts to configured webhook endpoints (Slack, Discord, PagerDuty).

---

## 📁 Repository Directory Structure

```
wello/
├── backend/                  # Nitro / Node.js API Backend
│   ├── database/             # Knex migrations & seeds
│   ├── routes/               # API endpoint route handlers
│   ├── tests/                # Automated unit, e2e, & security test suites
│   ├── utils/                # Business logic engines (Metrics, FX, Tax, Auth, Audit, Alerting)
│   └── Dockerfile            # Multi-stage production backend container
├── frontend/                 # Nuxt 3 Client Web Application
│   ├── pages/                # Nuxt pages (Dashboard, Invoices, Clients, Timer, Admin)
│   ├── components/           # Reusable UI components
│   └── Dockerfile            # Multi-stage production frontend container
├── nginx/                    # Nginx Configuration
│   ├── nginx.conf            # Main Nginx server config & gzip settings
│   └── default.conf          # Reverse proxy routing rules (/api -> backend, / -> frontend)
├── scripts/                  # Operational & Deployment Automation
│   ├── deploy.sh             # Linux/macOS zero-downtime server deploy script
│   ├── deploy.ps1            # Windows PowerShell server deploy script
│   ├── backup_restore.sh     # Linux/macOS DB backup, restore & DR drill tool
│   ├── backup_restore.ps1    # Windows PowerShell DB backup & restore tool
│   └── db_backup_restore.mjs # Cross-platform Node.js backup, restore & DR drill engine
├── docker-compose.yml        # Multi-container orchestration definition
├── .env.example              # Documented environment variables template
└── README.md                 # 10-Minute setup, architecture & operational guide
```

---

## 📄 License & Maintainer
Built with ❤️ for freelancers and independent contractors. Maintained by the Wello Engineering Team.
