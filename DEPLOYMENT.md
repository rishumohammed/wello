# Wello — Deployment, Containerization & Operations Guide

This guide covers production deployment, multi-container Docker Compose orchestration, environment configuration, database disaster recovery drills, and operational monitoring for Wello.

---

## 1. System Requirements & Topology

```
+-------------------------------------------------------------------------------+
|                                PRODUCTION HOST SERVER                         |
|                                                                               |
|   +-----------------------------------------------------------------------+   |
|   |                        Nginx 1.25 Alpine (Port 80 / 443)              |   |
|   +-----------------------------------+-----------------------------------+   |
|                                       |                                       |
|               +-----------------------+-----------------------+               |
|               | (/*)                                          | (/api/**)     |
|               v                                               v               |
|   +-----------------------+                       +-----------------------+   |
|   |  Nuxt 3 Frontend      |                       |  Nitro Node 20 Backend|   |
|   |  Container (:3000)    |                       |  Container (:3001)    |   |
|   +-----------------------+                       +-----------+-----------+   |
|                                                               |               |
|                               +-------------------------------+               |
|                               |                               |               |
|                               v                               v               |
|                   +-----------------------+       +-----------------------+   |
|                   |  MySQL 8.0 Database   |       |  Redis 7 Alpine Cache |   |
|                   |  Container (:3306)    |       |  Container (:6379)    |   |
|                   +-----------------------+       +-----------------------+   |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### Host Requirements
- **OS**: Linux (Ubuntu 20.04+, Debian 11+, RHEL 9+) or Windows Server 2022+
- **CPU**: 2+ Cores (4 Cores recommended for high-volume analytics rollups)
- **RAM**: 4GB+ (8GB recommended)
- **Disk**: 20GB+ SSD storage
- **Docker**: Docker Engine 24.0+ & Docker Compose 2.20+

---

## 2. Environment Configuration

Copy the template from `.env.example`:
```bash
cp .env.example .env
```

### Essential Production Variables
| Variable | Description | Production Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `production` |
| `DB_HOST` | MySQL database host | `mysql` (Docker) or `127.0.0.1` |
| `DB_USER` | MySQL database user | `wello_user` |
| `DB_PASSWORD` | MySQL user password | `strong_random_password_here` |
| `DB_NAME` | MySQL database name | `wello` |
| `REDIS_HOST` | Redis host | `redis` (Docker) or `127.0.0.1` |
| `REDIS_PASSWORD` | Redis authentication password | `strong_redis_password_here` |
| `SESSION_SECRET` | 64-char random hex key for session encryption | `openssl rand -hex 32` |
| `AUTH_HMAC_SECRET`| 64-char random hex key for OTP HMAC salting | `openssl rand -hex 32` |
| `CORS_ORIGIN` | Allowed web origins | `https://yourdomain.com` |
| `STORAGE_DRIVER` | File storage backend | `local` or `s3` |
| `BASE_CURRENCY` | Default base currency code | `USD` (or `EUR`, `GBP`, `INR`, etc.) |
| `CURRENCY_SYMBOL` | Default currency symbol | `$` (or `€`, `£`, `₹`, etc.) |
| `SENTRY_DSN` | Sentry error tracking URL (optional) | `https://...@sentry.io/...` |
| `ALERT_WEBHOOK_URL`| Slack / Discord alert webhook URL (optional) | `https://hooks.slack.com/...` |

---

## 3. Initial 10-Minute Setup (Docker Compose)

### 1. Build and Launch Containers
```bash
docker compose up -d --build
```

### 2. Apply Database Migrations
```bash
docker compose exec backend npx knex migrate:latest --knexfile knexfile.cjs
```

### 3. Verify Health Probes
```bash
curl http://localhost/api/health
# Returns: {"status":"healthy","uptime":...,"timestamp":...}
```

---

## 4. Manual Server Deployment (Pull from Git)

When updating the production server, execute the automated deployment pipeline:

### On Linux / macOS:
```bash
chmod +x ./scripts/deploy.sh
./scripts/deploy.sh
```

### On Windows Server (PowerShell):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1
```

### Deployment Pipeline Steps:
```
[1/6 Verify .env] ➔ [2/6 Git Pull] ➔ [3/6 Pre-Deploy DB Backup] ➔ [4/6 Docker Build & Up] ➔ [5/6 Knex Migration] ➔ [6/6 Health Probe]
```

If the health check probe fails after 12 retries, the deployment script aborts and directs operators to inspect `docker compose logs backend`.

---

## 5. Database Backups, Restores & Disaster Recovery Drills

Wello includes cross-platform database management engines ([`scripts/db_backup_restore.mjs`](scripts/db_backup_restore.mjs), [`scripts/backup_restore.sh`](scripts/backup_restore.sh), and [`scripts/backup_restore.ps1`](scripts/backup_restore.ps1)):

### A. Snapshot Backup
```bash
node ./scripts/db_backup_restore.mjs backup
```
- Creates a timestamped dump in `./backups/wello_backup_<timestamp>.sql`.
- Generates a cryptographic SHA-256 checksum file (`.sha256`).
- Automatically prunes backups older than 30 days.

### B. Database Restore
```bash
node ./scripts/db_backup_restore.mjs restore ./backups/wello_backup_20260921_215825.sql
```
- Validates the SHA-256 checksum against the `.sha256` integrity manifest.
- Restores all 57 tables, foreign keys, indexes, and records statement-by-statement.

### C. Automated Disaster Recovery Drill
```bash
node ./scripts/db_backup_restore.mjs drill
```
- Creates a temporary live snapshot.
- Spins up an isolated sandbox database (`wello_dr_drill_<timestamp>`).
- Restores the snapshot into the sandbox.
- **Verifies Schema**: Validates table count (57 tables), user records, and invoice records.
- **Verifies Audit Chain**: Traverses the SHA-256 audit log cryptographic ledger from genesis block to current block, verifying 100% hash integrity.
- Tears down the sandbox database and logs the certification pass.

---

## 6. SSL / TLS Configuration with Let's Encrypt Certbot

To enable HTTPS with automatic certificate renewal on Nginx:

1. Install Certbot on the host machine:
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   ```
2. Generate certificates:
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
   ```
3. Mount the certificate paths in `docker-compose.yml` under the `nginx` service:
   ```yaml
   volumes:
     - /etc/letsencrypt:/etc/letsencrypt:ro
     - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
     - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
   ```
4. Update `nginx/default.conf` to listen on port 443 with `ssl_certificate` and `ssl_certificate_key`.

---

## 7. Monitoring & Operational Health Checks

| Check Type | URL / Command | Expected Output | Remediation if Failing |
| :--- | :--- | :--- | :--- |
| **Liveness Probe** | `GET /api/health` | HTTP 200 `{"status":"healthy"}` | Restart backend container: `docker compose restart backend` |
| **Readiness Probe**| `GET /api/ready` | HTTP 200 `{"status":"ready"}` | Check MySQL connection: `docker compose logs mysql` |
| **Container Status**| `docker compose ps` | All containers `Up (healthy)` | Check failed container logs: `docker compose logs <service>` |
| **Disk Storage** | `df -h` | `< 85%` utilized | Prune old backups / Docker images: `docker image prune -a` |
