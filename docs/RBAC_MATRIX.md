# Wello — Database Seeded RBAC Matrix

*Generated dynamically from authoritative MySQL tables `admin_roles`, `admin_permissions`, and `admin_role_permissions`.*

| Module | Permission Key | Permission Description | **SUPER_ADMIN** | **ADMIN** | **MODERATOR** | **SUPPORT** | **ANALYST** |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| Analytics | `analytics.export` | Export platform aggregated analytics datasets | ✅ *(All)* | ✅ | ❌ | ❌ | ✅ |
| Analytics | `analytics.manage` | Trigger manual rollups, backfills, and cache management | ✅ *(All)* | ✅ | ❌ | ❌ | ❌ |
| Analytics | `analytics.view` | Access Analytics Center and reports | ✅ *(All)* | ✅ | ❌ | ❌ | ✅ |
| Audit | `audit_logs.view` | View system audit logs and event trails | ✅ *(All)* | ✅ | ✅ | ❌ | ✅ |
| Categories | `categories.manage` | Create, edit, reorder, and disable categories | ✅ *(All)* | ✅ | ✅ | ❌ | ❌ |
| Categories | `categories.view` | View job and service categories | ✅ *(All)* | ✅ | ✅ | ✅ | ✅ |
| Categories | `category_requests.manage` | Approve, reject, or merge category requests | ✅ *(All)* | ✅ | ✅ | ✅ | ❌ |
| Communications | `email.manage` | Configure Resend API, templates, and view logs | ✅ *(All)* | ✅ | ❌ | ✅ | ❌ |
| Feedback | `feedback.manage` | Triage, tag, and resolve user feedback items | ✅ *(All)* | ✅ | ❌ | ✅ | ❌ |
| Feedback | `feedback.view` | View and inspect user feedback and bug reports | ✅ *(All)* | ✅ | ✅ | ✅ | ❌ |
| Jobs | `jobs.moderate` | Flag, review, approve, and moderate job listings | ✅ *(All)* | ✅ | ✅ | ❌ | ❌ |
| Jobs | `jobs.view` | View jobs and service listings | ✅ *(All)* | ✅ | ✅ | ✅ | ✅ |
| Scheduler | `scheduler.manage` | Trigger and manage background scheduled jobs | ✅ *(All)* | ❌ | ❌ | ❌ | ❌ |
| Security | `admins.manage` | Manage admin users and assign RBAC roles | ✅ *(All)* | ❌ | ❌ | ❌ | ❌ |
| Settings | `settings.manage` | Configure global system parameters and retention policies | ✅ *(All)* | ❌ | ❌ | ❌ | ❌ |
| Store | `store.manage` | Manage addon store catalog, quotas, and incident kill-switches | ✅ *(All)* | ✅ | ❌ | ❌ | ❌ |
| System | `system.view` | Inspect low-level system health and diagnostic metrics | ✅ *(All)* | ✅ | ❌ | ❌ | ✅ |
| Users | `users.financial_view` | View individual user quotes, invoices, payments, and rates. Requires justification. | ✅ *(All)* | ❌ | ❌ | ❌ | ❌ |
| Users | `users.impersonate` | Time-boxed read-only support impersonation with mandatory reason logging. | ✅ *(All)* | ❌ | ❌ | ✅ | ❌ |
| Users | `users.manage` | Edit user details and roles | ✅ *(All)* | ✅ | ❌ | ❌ | ❌ |
| Users | `users.suspend` | Suspend, block, or reactivate accounts | ✅ *(All)* | ✅ | ❌ | ❌ | ❌ |
| Users | `users.view` | View user directory and profiles | ✅ *(All)* | ✅ | ✅ | ✅ | ✅ |
