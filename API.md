# Wello — Complete API Endpoint Reference

This document provides a comprehensive specification of all HTTP API endpoints across the Wello platform, detailing authentication guards, required payload schemas, query parameters, and response structures.

---

## 1. Authentication & Identity (`/api/auth/*`)

### `POST /api/auth/send-otp`
- **Auth**: Public (Rate Limited: 5 req / 5 min)
- **Body**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "OTP verification code sent to your email."
  }
  ```

### `POST /api/auth/verify-otp`
- **Auth**: Public (Rate Limited: 10 req / 10 min)
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "otp": "123456"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "token": "wello_sess_9a8f...",
    "user": { "id": 1, "email": "user@example.com", "name": "...", "role": "user" }
  }
  ```

### `POST /api/auth/logout`
- **Auth**: `requireUser`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Logged out successfully."
  }
  ```

### `POST /api/auth/impersonate/exit`
- **Auth**: `requireUser`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Exited impersonation mode."
  }
  ```

---

## 2. User Profile, Privacy & GDPR (`/api/me/*`)

### `GET /api/me`
- **Auth**: `requireUser`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "Jane Doe",
      "targetHourly": 85.00,
      "baseCurrency": "USD",
      "currencySymbol": "$",
      "timezone": "America/New_York",
      "earningPersona": "freelancer_projects",
      "includeOverheadInMetrics": true
    }
  }
  ```

### `PATCH /api/me`
- **Auth**: `requireUser`
- **Body**:
  ```json
  {
    "name": "Jane Doe",
    "targetHourly": 95.00,
    "baseCurrency": "EUR",
    "timezone": "Europe/Paris",
    "includeOverheadInMetrics": true
  }
  ```

### `POST /api/me/privacy`
- **Auth**: `requireUser`
- **Body**:
  ```json
  {
    "telemetryEnabled": false,
    "analyticsConsent": true
  }
  ```

### `POST /api/me/delete-account`
- **Auth**: `requireUser`
- **Body**:
  ```json
  {
    "confirmEmail": "user@example.com",
    "reason": "Moving to another platform"
  }
  ```
- **Response** (`200 OK`): Schedules GDPR account purge with 30-day grace period.

### `POST /api/me/cancel-deletion`
- **Auth**: `requireUser`
- **Response** (`200 OK`): Re-activates pending deleted account.

---

## 3. Work Sessions, Timers & Quick Entry (`/api/sessions/*`, `/api/timer/*`, `/api/quick-entry`)

### `POST /api/quick-entry`
- **Auth**: `requireUser` (Mutation blocked during impersonation)
- **Body**:
  ```json
  {
    "type": "timer | payment | invoice | expense",
    "action": "start | stop | log | create",
    "projectId": 12,
    "amount": 750.00,
    "description": "API Integration"
  }
  ```

### `POST /api/timer/start`
- **Auth**: `requireUser` (Mutation blocked during impersonation)
- **Body**:
  ```json
  {
    "projectId": 12,
    "title": "Backend Migration",
    "isBillable": true
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "session": { "id": 105, "startTime": "2026-09-21T21:00:00Z", "status": "ACTIVE" }
  }
  ```

### `POST /api/timer/stop`
- **Auth**: `requireUser` (Mutation blocked during impersonation)
- **Body**:
  ```json
  {
    "sessionId": 105,
    "notes": "Completed Knex migration scripts"
  }
  ```

### `GET /api/sessions`
- **Auth**: `requireUser`
- **Query**: `?projectId=12&from=2026-09-01&to=2026-09-21`
- **Response** (`200 OK`): Returns paginated work session records with durations and earned values.

---

## 4. Metrics & Hourly Intelligence (`/api/metrics/*`)

### `GET /api/metrics/summary`
- **Auth**: `requireUser`
- **Query**: `?period=30d` (Options: `7d`, `30d`, `90d`, `365d`, `all`)
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "metrics": {
      "targetHourlyRate": 85.00,
      "effectiveHourlyRate": 104.20,
      "rateVariance": 22.58,
      "varianceStatus": "ABOVE_TARGET",
      "totalHours": 42.5,
      "billableHours": 36.0,
      "unbillableHours": 6.5,
      "collectedRevenue": 4428.50,
      "earnedRevenue": 5100.00,
      "uncollectedRevenue": 671.50,
      "overheadDeductions": 120.00,
      "directExpenses": 45.00
    }
  }
  ```

---

## 5. Invoicing & Quotes Subsystem (`/api/invoices/*`, `/api/quotes/*`)

### `GET /api/invoices`
- **Auth**: `requireUser`
- **Query**: `?status=ALL&limit=50&offset=0`
- **Response** (`200 OK`): Returns array of invoice summaries with payment balances.

### `POST /api/invoices`
- **Auth**: `requireUser` (Mutation blocked during impersonation)
- **Body**:
  ```json
  {
    "clientId": 5,
    "projectId": 12,
    "issueDate": "2026-09-21",
    "dueDate": "2026-10-05",
    "currencyCode": "USD",
    "items": [
      { "description": "Backend API Hardening", "quantity": 10, "unitPrice": 100.00, "taxRate": 10.0 }
    ],
    "notes": "Thank you for your business!"
  }
  ```

### `GET /api/invoices/:id`
- **Auth**: `requireUser`
- **Response** (`200 OK`): Complete invoice object including line items, taxes, payments, and audit history.

### `POST /api/invoices/status`
- **Auth**: `requireUser` (Mutation blocked during impersonation)
- **Body**:
  ```json
  {
    "invoiceId": 47,
    "status": "PAID",
    "paidDate": "2026-09-21",
    "paymentMethod": "STRIPE"
  }
  ```

### `GET /api/invoices/public/:token`
- **Auth**: Public
- **Response** (`200 OK`): Clean, branded public invoice view for client review and settlement.

---

## 6. Non-Project Income & Overhead Expenses (`/api/income-sources/*`, `/api/overhead-expenses/*`)

### `GET /api/income-sources`
- **Auth**: `requireUser`
- **Response** (`200 OK`): Lists recurring and one-off non-project revenue streams.

### `POST /api/income-sources`
- **Auth**: `requireUser` (Mutation blocked during impersonation)
- **Body**:
  ```json
  {
    "name": "Design Systems Retainer",
    "category": "retainer",
    "amount": 1500.00,
    "currencyCode": "USD",
    "frequency": "monthly"
  }
  ```

### `GET /api/overhead-expenses`
- **Auth**: `requireUser`
- **Response** (`200 OK`): Lists operational expenses (software, subscriptions, rent).

### `POST /api/overhead-expenses`
- **Auth**: `requireUser` (Mutation blocked during impersonation)
- **Body**:
  ```json
  {
    "name": "Adobe Creative Cloud",
    "category": "software",
    "amount": 54.99,
    "currencyCode": "USD",
    "frequency": "monthly"
  }
  ```

---

## 7. Free Addons & Store Entitlements (`/api/store/addons/*`)

### `GET /api/store/addons`
- **Auth**: `requireUser`
- **Response** (`200 OK`): Returns 100% free addon catalog with user activation statuses.

### `POST /api/store/addons/activate`
- **Auth**: `requireUser`
- **Body**:
  ```json
  {
    "addonKey": "invoicing_pro"
  }
  ```

---

## 8. Admin Console & Privacy Controls (`/api/admin/*`)

### `GET /api/admin/users`
- **Auth**: `requirePermission('users.view')`
- **Response** (`200 OK`): Lists registered users with activity aggregates (individual financials omitted).

### `GET /api/admin/users/:id/financials`
- **Auth**: `requirePermission('users.financial_view')`
- **Query**: `?reason=Audit+ticket+%239481` (Mandatory non-empty justification string)
- **Response** (`200 OK`): Returns unmasked financial breakdown and records a SHA-256 audit block.

### `POST /api/admin/users/impersonate`
- **Auth**: `requirePermission('users.impersonate')`
- **Body**:
  ```json
  {
    "userId": 55,
    "reason": "Investigating invoice PDF render failure"
  }
  ```
- **Response** (`200 OK`): Returns temporary 15-minute read-only impersonation token.

### `GET /api/admin/audit-logs`
- **Auth**: `requirePermission('audit.view')`
- **Response** (`200 OK`): Returns paginated audit trail with SHA-256 block hashes and previous hashes.

### `GET /api/admin/audit-logs/verify`
- **Auth**: `requirePermission('audit.view')`
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "valid": true,
    "totalEntries": 25,
    "verifiedAt": "2026-09-21T22:00:00Z"
  }
  ```

---

## 9. Observability & Health Probes

### `GET /api/health`
- **Auth**: Public
- **Response** (`200 OK`):
  ```json
  {
    "status": "healthy",
    "uptime": 86400,
    "timestamp": "2026-09-21T22:00:00.000Z",
    "memory": { "rss": 84123648, "heapUsed": 45123984 }
  }
  ```

### `GET /api/ready`
- **Auth**: Public
- **Response** (`200 OK`):
  ```json
  {
    "status": "ready",
    "database": "connected",
    "pool": { "free": 8, "used": 2 }
  }
  ```
