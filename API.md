# Wello — Complete API Endpoint Reference

This document provides an exhaustive, code-generated specification of all HTTP API endpoints across the Wello platform, detailing authentication guards, step-up requirements, required permissions, free addon requirements, impersonation safety policies, sliding window rate limits, and functional purposes.

*Generated dynamically from authoritative Nitro route handlers in `backend/api` (202 total endpoints).*

---

## Complete API Endpoint Catalog

| HTTP Method | Route Endpoint | Auth Guard | Step-Up | Required Permission | Required Addon | Impersonation Policy | Rate Limit | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/analytics` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin management operation |
| `GET` | `/api/admin/analytics/addons` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `POST` | `/api/admin/analytics/backfill` | `requirePermission('analytics.manage')` | `analytics_backfill` | `analytics.manage` | — | Blocked (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/categories` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/cohorts` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | User retention cohorts ($k \ge 5$ privacy enforced) |
| `GET` | `/api/admin/analytics/engagement` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/export` | `requirePermission('analytics.export')` | — | `analytics.export` | — | Blocked (Data Export) | Admin (120/min) | Export platform analytics dataset |
| `GET` | `/api/admin/analytics/funnel` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/geography` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/invoicing` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/messaging` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/metrics` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/operations` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/overview` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Get admin high-level platform KPI summary |
| `GET` | `/api/admin/analytics/retention` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/rollups` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `POST` | `/api/admin/analytics/rollups/run` | `requirePermission('analytics.manage')` | — | `analytics.manage` | — | Blocked (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/security` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/system-health` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Platform health, error rates, p50/p95 latency metrics |
| `GET` | `/api/admin/analytics/tools/anomalies` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/tools/drilldown` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `DELETE` | `/api/admin/analytics/tools/saved-views` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Blocked (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/tools/saved-views` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `POST` | `/api/admin/analytics/tools/saved-views` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Blocked (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `DELETE` | `/api/admin/analytics/tools/scheduled-reports` | `requirePermission('analytics.manage')` | — | `analytics.manage` | — | Blocked (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/tools/scheduled-reports` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `POST` | `/api/admin/analytics/tools/scheduled-reports` | `requirePermission('analytics.manage')` | — | `analytics.manage` | — | Blocked (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/analytics/work-value` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin analytics module breakdown |
| `GET` | `/api/admin/audit-logs` | `requirePermission('audit_logs.view')` | — | `audit_logs.view` | — | Allowed (Read-Only) | Admin (120/min) | List tamper-evident cryptographic audit logs |
| `GET` | `/api/admin/audit-logs/verify` | `requirePermission('audit_logs.view')` | — | `audit_logs.view` | — | Allowed (Read-Only) | Admin (120/min) | Cryptographically verify entire HMAC-SHA256 audit chain |
| `POST` | `/api/admin/categories` | `requirePermission('categories.manage')` | — | `categories.manage` | — | Blocked (Read-Only) | Admin (120/min) | Approve or manage system categories |
| `GET` | `/api/admin/categories/intelligence` | `requirePermission('categories.view')` | — | `categories.view` | — | Allowed (Read-Only) | Admin (120/min) | Approve or manage system categories |
| `GET` | `/api/admin/category-requests` | `requirePermission('category_requests.manage')` | — | `category_requests.manage` | — | Allowed (Read-Only) | Admin (120/min) | Admin management operation |
| `POST` | `/api/admin/category-requests` | `requirePermission('category_requests.manage')` | — | `category_requests.manage` | — | Blocked (Read-Only) | Admin (120/min) | Admin management operation |
| `GET` | `/api/admin/config` | `requirePermission('settings.manage')` | — | `settings.manage` | — | Allowed (Read-Only) | Admin (120/min) | Admin management operation |
| `POST` | `/api/admin/config` | `requirePermission('settings.manage')` | — | `settings.manage` | — | Blocked (Read-Only) | Admin (120/min) | Admin management operation |
| `GET` | `/api/admin/email-templates` | `requirePermission('email.manage')` | — | `email.manage` | — | Allowed (Read-Only) | Admin (120/min) | Manage transactional email templates |
| `POST` | `/api/admin/email-templates` | `requirePermission('email.manage')` | — | `email.manage` | — | Blocked (Read-Only) | Admin (120/min) | Manage transactional email templates |
| `GET` | `/api/admin/email/preview` | `requirePermission('email.manage')` | — | `email.manage` | — | Allowed (Read-Only) | Admin (120/min) | Admin management operation |
| `GET` | `/api/admin/feedback` | `requirePermission('feedback.view')` | — | `feedback.view` | — | Allowed (Read-Only) | Admin (120/min) | View and triage user feedback inbox |
| `PATCH` | `/api/admin/feedback/:id` | `requirePermission('feedback.manage')` | — | `feedback.manage` | — | Blocked (Read-Only) | Admin (120/min) | View and triage user feedback inbox |
| `GET` | `/api/admin/funnel` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin management operation |
| `GET` | `/api/admin/jobs` | `requirePermission('jobs.view')` | — | `jobs.view` | — | Allowed (Masked Financials) | Admin (120/min) | List platform jobs & moderation queue |
| `POST` | `/api/admin/jobs/moderate` | `requirePermission('jobs.moderate')` | — | `jobs.moderate` | — | Blocked (Read-Only) | Admin (120/min) | Flag or resolve job moderation status |
| `GET` | `/api/admin/logs` | `requirePermission('audit_logs.view')` | — | `audit_logs.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin management operation |
| `GET` | `/api/admin/retention/policies` | `requirePermission('settings.manage')` | — | `settings.manage` | — | Allowed (Read-Only) | Admin (120/min) | Admin management operation |
| `POST` | `/api/admin/retention/run` | `requirePermission('settings.manage')` | `retention` | `settings.manage` | — | Blocked (Read-Only) | Admin (120/min) | Admin management operation |
| `GET` | `/api/admin/roles` | `requirePermission('admins.manage')` | — | `admins.manage` | — | Allowed (Read-Only) | Admin (120/min) | Manage RBAC admin roles & permissions |
| `POST` | `/api/admin/roles` | `requirePermission('admins.manage')` | `roles` | `admins.manage` | — | Blocked (Read-Only) | Admin (120/min) | Manage RBAC admin roles & permissions |
| `POST` | `/api/admin/security/request-otp` | `requireAdmin` | — | `admin` | — | Blocked (Read-Only) | Admin (120/min) | Admin management operation |
| `GET` | `/api/admin/stats` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | Admin management operation |
| `GET` | `/api/admin/store/addons` | `requirePermission('store.manage')` | — | `store.manage` | — | Allowed (Read-Only) | Admin (120/min) | Manage addon store catalog & kill-switches |
| `POST` | `/api/admin/store/addons` | `requirePermission('store.manage')` | — | `store.manage` | — | Blocked (Read-Only) | Admin (120/min) | Manage addon store catalog & kill-switches |
| `GET` | `/api/admin/store/analytics` | `requirePermission('store.manage')` | — | `store.manage` | — | Allowed (Read-Only) | Admin (120/min) | Manage addon store catalog & kill-switches |
| `POST` | `/api/admin/store/kill-switch` | `requirePermission('store.manage')` | `addon_kill_switch` | `store.manage` | — | Blocked (Read-Only) | Admin (120/min) | Manage addon store catalog & kill-switches |
| `GET` | `/api/admin/store/limits` | `requirePermission('store.manage')` | — | `store.manage` | — | Allowed (Read-Only) | Admin (120/min) | Manage addon store catalog & kill-switches |
| `PUT` | `/api/admin/store/limits` | `requirePermission('store.manage')` | — | `store.manage` | — | Blocked (Read-Only) | Admin (120/min) | Manage addon store catalog & kill-switches |
| `GET` | `/api/admin/store/personas` | `requirePermission('store.manage')` | — | `store.manage` | — | Allowed (Read-Only) | Admin (120/min) | Manage addon store catalog & kill-switches |
| `PUT` | `/api/admin/store/personas` | `requirePermission('store.manage')` | — | `store.manage` | — | Blocked (Read-Only) | Admin (120/min) | Manage addon store catalog & kill-switches |
| `GET` | `/api/admin/store/user-addons` | `requirePermission('store.manage')` | — | `store.manage` | — | Allowed (Read-Only) | Admin (120/min) | Manage addon store catalog & kill-switches |
| `POST` | `/api/admin/store/user-addons` | `requirePermission('store.manage')` | `user_addon_grant` | `store.manage` | — | Blocked (Read-Only) | Admin (120/min) | Manage addon store catalog & kill-switches |
| `POST` | `/api/admin/test-email` | `requirePermission('email.manage')` | — | `email.manage` | — | Blocked (Read-Only) | Admin (120/min) | Admin management operation |
| `GET` | `/api/admin/users` | `requirePermission('users.view')` | — | `users.view` | — | Allowed (Read-Only) | Admin (120/min) | List user directory (masked financials) |
| `GET` | `/api/admin/users/:id` | `requirePermission('users.view')` | — | `users.view` | — | Allowed (Read-Only) | Admin (120/min) | Get administrative user summary |
| `POST` | `/api/admin/users/:id/financials` | `requirePermission('users.financial_view')` | `financial_view` | `users.financial_view` | — | Blocked (Read-Only) | Admin (120/min) | Access user financials with mandatory justification & SHA-256 audit |
| `POST` | `/api/admin/users/impersonate` | `requirePermission('users.impersonate')` | `impersonation_start` | `users.impersonate` | — | Allowed (Masked Financials) | Admin (120/min) | Start 15-minute read-only support impersonation session |
| `POST` | `/api/admin/users/status` | `requirePermission('users.suspend')` | `user_status` | `users.suspend` | — | Blocked (Read-Only) | Admin (120/min) | Suspend or activate user account |
| `POST` | `/api/auth/impersonate/exit` | `requireUser` | — | — | — | Allowed (Exit/Logout) | Global (100/min) | Exit read-only admin impersonation session |
| `POST` | `/api/auth/logout` | Public | — | — | — | Public (No Session) | Global (100/min) | Revoke active user session |
| `POST` | `/api/auth/logout-all` | `requireUser` | — | — | — | Allowed (Exit/Logout) | Global (100/min) | Revoke all sessions for current user |
| `POST` | `/api/auth/send-otp` | Public | — | — | — | Public (No Session) | 5 req / 5 min | Send email or SMS verification OTP |
| `GET` | `/api/auth/session` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | Check current session authentication state |
| `GET` | `/api/auth/sessions` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | List active user login sessions |
| `DELETE` | `/api/auth/sessions/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Revoke specific user session by ID |
| `GET` | `/api/auth/unsubscribe` | Public | — | — | — | Public (No Session) | Global (100/min) | Verify unsubscribe token |
| `POST` | `/api/auth/unsubscribe` | Optional User | — | — | — | Public (No Session) | Global (100/min) | Unsubscribe from email communications |
| `POST` | `/api/auth/verify-otp` | Public | — | — | — | Public (No Session) | 10 req / 10 min | Validate OTP and issue session token |
| `POST` | `/api/calculator/apply-quote` | `requireAddon('pricing-calculator')` | — | — | `pricing-calculator` | Blocked (Read-Only) | Global (100/min) | Apply calculated rate to draft quote |
| `POST` | `/api/calculator/pricing` | `requireAddon('pricing-calculator')` | — | — | `pricing-calculator` | Blocked (Read-Only) | Global (100/min) | Calculate target rate from salary goal |
| `GET` | `/api/categories` | Public | — | — | — | Public (No Session) | Global (100/min) | List custom work categories |
| `GET` | `/api/category-requests` | `requireUser` | — | — | — | Allowed (Read-Only) | Global (100/min) | List category requests |
| `POST` | `/api/category-requests` | Public | — | — | — | Public (No Session) | 5 req / 1 hour | Submit category addition request |
| `GET` | `/api/clients` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | List client CRM profiles |
| `POST` | `/api/clients` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Create client CRM profile |
| `DELETE` | `/api/clients/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Delete client |
| `GET` | `/api/clients/:id` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | Get client profile |
| `PATCH` | `/api/clients/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Update client |
| `POST` | `/api/events` | Optional User | — | — | — | Public (No Session) | 120 req / min | Ingest client telemetry and analytics event |
| `GET` | `/api/expected-payments` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | List outstanding expected payments |
| `POST` | `/api/expected-payments/confirm` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Confirm settlement of expected payment |
| `GET` | `/api/expenses` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | List direct project expenses |
| `POST` | `/api/expenses` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Create project expense |
| `DELETE` | `/api/expenses/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Delete expense |
| `GET` | `/api/expenses/:id` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | Get expense details |
| `PATCH` | `/api/expenses/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Update expense |
| `GET` | `/api/export/all` | `requireUser` | — | — | — | Blocked (Data Export) | 10 req / min | Export GDPR full account data bundle |
| `GET` | `/api/export/csv` | `requireUser` | — | — | — | Blocked (Data Export) | 10 req / min | Export GDPR full account data bundle |
| `GET` | `/api/export/json` | `requireUser` | — | — | — | Blocked (Data Export) | 10 req / min | Export GDPR full account data bundle |
| `POST` | `/api/feedback` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Submit user feedback or bug report |
| `POST` | `/api/fx/convert` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Convert currency amount using historical/live rates |
| `GET` | `/api/fx/rates` | `requireUser` | — | — | — | Allowed (Read-Only) | Global (100/min) | Fetch live exchange rates |
| `GET` | `/api/health` | Public | — | — | — | Public (No Session) | Global (100/min) | Liveness probe returning system status |
| `GET` | `/api/health/details` | `requirePermission('system.view')` | — | `system.view` | — | Allowed (Read-Only) | Global (100/min) | Detailed system health metrics |
| `POST` | `/api/import/execute` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Execute validated timesheet and invoice import |
| `POST` | `/api/import/preview` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Preview CSV / Toggl / Clockify import dataset |
| `GET` | `/api/income-sources` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | List non-project income streams |
| `POST` | `/api/income-sources` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Create non-project income stream |
| `DELETE` | `/api/income-sources/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Delete income stream |
| `GET` | `/api/income-sources/:id` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | Get income stream |
| `PATCH` | `/api/income-sources/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Update income stream |
| `GET` | `/api/invoices` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Allowed (Masked Financials) | Global (100/min) | List invoices with status and balances |
| `POST` | `/api/invoices` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Blocked (Read-Only) | Global (100/min) | Create new invoice with items & taxes |
| `DELETE` | `/api/invoices/:id` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Blocked (Read-Only) | Global (100/min) | Delete or void draft invoice |
| `GET` | `/api/invoices/:id` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Allowed (Masked Financials) | Global (100/min) | Get invoice details |
| `PATCH` | `/api/invoices/:id` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Blocked (Read-Only) | Global (100/min) | Delete or void draft invoice |
| `POST` | `/api/invoices/:id/confirm-claim` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Blocked (Read-Only) | Global (100/min) | Confirm invoice revenue ownership |
| `POST` | `/api/invoices/:id/credit-notes` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Blocked (Read-Only) | Global (100/min) | Issue credit note adjusting invoice balance |
| `POST` | `/api/invoices/:id/mark-sent` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Blocked (Read-Only) | Global (100/min) | Mark invoice as sent out-of-band |
| `POST` | `/api/invoices/:id/payments` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Blocked (Read-Only) | Global (100/min) | Record payment against invoice |
| `GET` | `/api/invoices/:id/pdf` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Blocked (Data Export) | Global (100/min) | Generate or stream downloadable invoice PDF |
| `POST` | `/api/invoices/:id/send` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Blocked (Read-Only) | Global (100/min) | Send invoice to client via Resend email |
| `POST` | `/api/invoices/evaluate-overdue` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Blocked (Read-Only) | Global (100/min) | Trigger overdue evaluation for user invoices |
| `POST` | `/api/invoices/from-job` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Blocked (Read-Only) | Global (100/min) | Generate draft invoice from completed work session |
| `GET` | `/api/invoices/public/:token` | Public | — | — | — | Public (No Session) | 30 req / min | Public client invoice portal view |
| `POST` | `/api/invoices/public/:token/action` | Public | — | — | — | Public (No Session) | 30 req / min | Public client invoice payment/approval action |
| `GET` | `/api/invoices/public/:token/pdf` | Public | — | — | — | Public (No Session) | 30 req / min | Public client downloadable invoice PDF |
| `GET` | `/api/invoices/recurring` | `requireAddon('recurring-retainers')` | — | — | `recurring-retainers` | Allowed (Masked Financials) | Global (100/min) | List recurring invoice profiles |
| `POST` | `/api/invoices/recurring` | `requireAddon('recurring-retainers')` | — | — | `recurring-retainers` | Blocked (Read-Only) | Global (100/min) | Create recurring invoice retainer profile |
| `DELETE` | `/api/invoices/recurring/:id` | `requireAddon('recurring-retainers')` | — | — | `recurring-retainers` | Blocked (Read-Only) | Global (100/min) | DELETE endpoint for /api/invoices/recurring/:id |
| `PATCH` | `/api/invoices/recurring/:id` | `requireAddon('recurring-retainers')` | — | — | `recurring-retainers` | Blocked (Read-Only) | Global (100/min) | PATCH endpoint for /api/invoices/recurring/:id |
| `POST` | `/api/invoices/recurring/:id/pause` | `requireAddon('recurring-retainers')` | — | — | `recurring-retainers` | Blocked (Read-Only) | Global (100/min) | POST endpoint for /api/invoices/recurring/:id/pause |
| `POST` | `/api/invoices/recurring/:id/resume` | `requireAddon('recurring-retainers')` | — | — | `recurring-retainers` | Blocked (Read-Only) | Global (100/min) | POST endpoint for /api/invoices/recurring/:id/resume |
| `POST` | `/api/invoices/status` | `requireAddon('basic-invoicing')` | — | — | `basic-invoicing` | Blocked (Read-Only) | Global (100/min) | Transition invoice state machine |
| `GET` | `/api/me` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | Get current user profile & settings |
| `PATCH` | `/api/me` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Update profile & settings |
| `POST` | `/api/me/cancel-deletion` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Cancel pending GDPR account deletion |
| `POST` | `/api/me/delete-account` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Schedule GDPR account soft-deletion (30d grace) |
| `GET` | `/api/me/privacy` | `requireUser` | — | — | — | Allowed (Read-Only) | Global (100/min) | Fetch privacy & telemetry consent preferences |
| `POST` | `/api/me/privacy` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Update privacy & telemetry preferences |
| `POST` | `/api/me/reset-work-data` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Reset work sessions, invoices, and payments |
| `GET` | `/api/metrics/insights` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | Get rate distribution and anomaly intelligence |
| `GET` | `/api/metrics/summary` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | Get dual hourly rates ($R_{\text{client\_work}}$, $R_{\text{all\_in}}$) & revenue |
| `GET` | `/api/notifications` | `requireUser` | — | — | — | Allowed (Read-Only) | Global (100/min) | List notifications with unread counts |
| `DELETE` | `/api/notifications/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Delete notification by ID |
| `PATCH` | `/api/notifications/:id/read` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Mark single notification as read |
| `POST` | `/api/notifications/mark-all-read` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Mark all user notifications as read |
| `GET` | `/api/notifications/preferences` | `requireUser` | — | — | — | Allowed (Read-Only) | Global (100/min) | Get notification preferences |
| `PUT` | `/api/notifications/preferences` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Update notification preferences |
| `POST` | `/api/notifications/push/subscribe` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Register Web Push subscription |
| `POST` | `/api/notifications/push/test` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Dispatch test push notification |
| `POST` | `/api/notifications/push/unsubscribe` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Unregister Web Push subscription |
| `GET` | `/api/notifications/push/vapid-key` | Public | — | — | — | Public (No Session) | Global (100/min) | Get public VAPID application server key |
| `GET` | `/api/overhead-expenses` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | List recurring overhead expenses |
| `POST` | `/api/overhead-expenses` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Create overhead expense |
| `DELETE` | `/api/overhead-expenses/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Delete overhead expense |
| `PATCH` | `/api/overhead-expenses/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Update overhead expense |
| `GET` | `/api/payments` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | List payment transactions |
| `POST` | `/api/payments` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Record manual payment |
| `DELETE` | `/api/payments/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Delete payment |
| `GET` | `/api/payments/:id` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | Get payment details |
| `PATCH` | `/api/payments/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Update payment |
| `GET` | `/api/projects` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | List projects with effective rates |
| `POST` | `/api/projects` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Create new project |
| `DELETE` | `/api/projects/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Delete project |
| `GET` | `/api/projects/:id` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | Get project details |
| `PATCH` | `/api/projects/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Update project |
| `GET` | `/api/projects/:id/quotes` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | List quotes for project |
| `POST` | `/api/projects/:id/quotes` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Create quote for project |
| `PATCH` | `/api/projects/:id/quotes/:quoteId` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Update project quote |
| `POST` | `/api/quick-entry` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Unified quick entry for timers, payments, and invoices |
| `GET` | `/api/quotes/:id/pdf` | `requireUser` | — | — | — | Blocked (Data Export) | Global (100/min) | Generate quote proposal PDF |
| `GET` | `/api/quotes/public/:token` | Public | — | — | — | Public (No Session) | 30 req / min | Public client quote portal view |
| `POST` | `/api/quotes/public/:token/action` | Public | — | — | — | Public (No Session) | 30 req / min | Public client quote accept/decline action |
| `GET` | `/api/ready` | Public | — | — | — | Public (No Session) | Global (100/min) | Readiness probe verifying MySQL pool health |
| `GET` | `/api/reports/export` | `requireAddon('executive-reports')` | — | — | `executive-reports` | Blocked (Data Export) | Global (100/min) | Export period reports (CSV/JSON/PDF) |
| `GET` | `/api/reports/summary` | `requireAddon('executive-reports')` | — | — | `executive-reports` | Allowed (Read-Only) | Global (100/min) | Get aggregated period performance reports |
| `POST` | `/api/scheduler/run` | `requirePermission('scheduler.manage')` | `scheduler_run` | `scheduler.manage` | — | Blocked (Read-Only) | Global (100/min) | Manually trigger scheduled job by key |
| `GET` | `/api/sessions` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | List paginated work sessions with filters |
| `POST` | `/api/sessions` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Create manual work session |
| `DELETE` | `/api/sessions/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Delete work session |
| `GET` | `/api/sessions/:id` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | Get work session details |
| `PATCH` | `/api/sessions/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Update work session |
| `GET` | `/api/sessions/:id/history` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | Get audit edit history for work session |
| `GET` | `/api/store/addons` | `requireUser` | — | — | — | Allowed (Read-Only) | Global (100/min) | List available free addon catalog |
| `POST` | `/api/store/addons/activate` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Activate free addon for account |
| `POST` | `/api/store/addons/deactivate` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | POST endpoint for /api/store/addons/deactivate |
| `GET` | `/api/sync` | `requireUser` | — | — | — | Allowed (Read-Only) | Global (100/min) | Delta pull synchronization with deletion tombstones |
| `POST` | `/api/sync` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Idempotent batched offline mutation push |
| `GET` | `/api/tax-rates` | `requireUser` | — | — | — | Allowed (Read-Only) | Global (100/min) | List tax rates |
| `POST` | `/api/tax-rates` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Create custom tax rate |
| `DELETE` | `/api/tax-rates/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Delete tax rate |
| `PATCH` | `/api/tax-rates/:id` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Update tax rate |
| `GET` | `/api/timer/active` | `requireUser` | — | — | — | Allowed (Read-Only) | Global (100/min) | Get currently running timer session |
| `POST` | `/api/timer/heartbeat` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Record active timer heartbeat & detect idle |
| `POST` | `/api/timer/pause` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Pause running timer session |
| `POST` | `/api/timer/resume` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Resume paused timer session |
| `POST` | `/api/timer/start` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Start server-authoritative timer session |
| `POST` | `/api/timer/stop` | `requireUser` | — | — | — | Blocked (Read-Only) | Global (100/min) | Stop active timer and persist work session |
| `GET` | `/api/timezones` | Public | — | — | — | Public (No Session) | Global (100/min) | List IANA timezones and current UTC offsets |
| `POST` | `/api/upload/logo` | `requireUser` | — | — | — | Blocked (Read-Only) | 20 req / min | Upload invoice logo image (magic-byte verified) |
| `GET` | `/api/uploads/:filename` | Public | — | — | — | Public (No Session) | 20 req / min | Serve uploaded brand image with caching |
| `POST` | `/api/webhooks/resend` | Public | — | — | — | Public (No Session) | Global (100/min) | Resend webhook for email delivery/bounce tracking |
| `GET` | `/api/billing/status` | `requireUser` | — | — | — | Allowed (Masked Financials) | Global (100/min) | Get user's active SaaS subscription & 90-day trial status |
| `POST` | `/api/billing/create-subscription` | `requireUser` | — | — | — | Blocked (Read-Only) | 10 req / min | Create Razorpay customer and initiate recurring subscription |
| `POST` | `/api/billing/cancel-subscription` | `requireUser` | — | — | — | Blocked (Read-Only) | 10 req / min | Schedule Razorpay subscription cancellation at period end |
| `POST` | `/api/billing/resume-subscription` | `requireUser` | — | — | — | Blocked (Read-Only) | 10 req / min | Resume pending cancellation of Razorpay recurring subscription |
| `POST` | `/api/billing/webhook` | Public | — | — | — | Public (No Session) | Global (100/min) | Razorpay HMAC-SHA256 authenticated subscription lifecycle webhook |
| `GET` | `/api/admin/analytics/subscriptions` | `requirePermission('analytics.view')` | — | `analytics.view` | — | Allowed (Read-Only) | Admin (120/min) | SaaS MRR, trial conversion rate, and churn metrics |
| `POST` | `/api/admin/users/:id/extend-trial` | `requirePermission('users.suspend')` | — | `users.suspend` | — | Blocked (Read-Only) | Admin (120/min) | Admin grant extending user's free trial by N days |
| `POST` | `/api/admin/users/:id/comp-subscription` | `requirePermission('users.suspend')` | — | `users.suspend` | — | Blocked (Read-Only) | Admin (120/min) | Grant permanent complimentary VIP access to user account |

---

## Error Response Format
All endpoints adhere to standardized JSON error envelopes:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description of error",
    "details": {}
  }
}
```
