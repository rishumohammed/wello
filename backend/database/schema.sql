-- Wello Database Schema (MySQL 8)
-- Single Source of Truth for Work Value, Invoicing, RBAC & Platform Intelligence

CREATE DATABASE IF NOT EXISTS wello CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wello;

-- =============================================
-- 1. USERS
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  avatar_initials VARCHAR(4) DEFAULT NULL,
  target_hourly   DECIMAL(19,4) DEFAULT NULL,
  base_currency   VARCHAR(3) NOT NULL DEFAULT 'USD',
  timezone        VARCHAR(50) NOT NULL DEFAULT 'UTC',
  country         VARCHAR(2) DEFAULT NULL,
  phone_e164      VARCHAR(50) UNIQUE DEFAULT NULL,
  status          ENUM('REGISTERED','EMAIL_PENDING','VERIFICATION_PENDING','VERIFIED','ACTIVE','INACTIVE','SUSPENDED','BLOCKED') NOT NULL DEFAULT 'ACTIVE',
  role            ENUM('user','admin') NOT NULL DEFAULT 'user',
  state           VARCHAR(100) DEFAULT NULL,
  city            VARCHAR(100) DEFAULT NULL,
  business_name   VARCHAR(200) DEFAULT NULL,
  business_address TEXT DEFAULT NULL,
  business_tax_id VARCHAR(100) DEFAULT NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at      DATETIME(3) DEFAULT NULL,
  INDEX idx_users_status (status),
  INDEX idx_users_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 2. CATEGORIES
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  parent_id     INT DEFAULT NULL,
  name          VARCHAR(150) NOT NULL,
  slug          VARCHAR(150) UNIQUE NOT NULL,
  description   TEXT DEFAULT NULL,
  icon          VARCHAR(50) NOT NULL DEFAULT 'IconBriefcase',
  display_order INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_categories_parent (parent_id),
  INDEX idx_categories_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 3. CLIENTS
-- =============================================
CREATE TABLE IF NOT EXISTS clients (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(200) NOT NULL,
  email       VARCHAR(255) DEFAULT NULL,
  phone_e164  VARCHAR(50) DEFAULT NULL,
  company     VARCHAR(200) DEFAULT NULL,
  country     VARCHAR(2) DEFAULT NULL,
  notes       TEXT DEFAULT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at  DATETIME(3) DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_clients_user_id (user_id),
  INDEX idx_clients_user_deleted (user_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 4. PROJECTS
-- =============================================
CREATE TABLE IF NOT EXISTS projects (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  client_id       INT DEFAULT NULL,
  category_id     INT DEFAULT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT DEFAULT NULL,
  service_category VARCHAR(150) DEFAULT NULL,
  status          ENUM('potential','quoted','approved','in_progress','completed','lost') NOT NULL DEFAULT 'potential',
  is_job          BOOLEAN NOT NULL DEFAULT FALSE,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  quote_amount    DECIMAL(19,4) DEFAULT NULL,
  quote_date      DATE DEFAULT NULL,
  quote_est_hours DECIMAL(8,2) DEFAULT NULL,
  quote_notes     TEXT DEFAULT NULL,
  quote_status    ENUM('draft','sent','accepted','rejected') NOT NULL DEFAULT 'draft',
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at      DATETIME(3) DEFAULT NULL,
  FOREIGN KEY (user_id)     REFERENCES users(id),
  FOREIGN KEY (client_id)   REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_projects_user_id (user_id),
  INDEX idx_projects_client_id (client_id),
  INDEX idx_projects_category_id (category_id),
  INDEX idx_projects_status (status),
  INDEX idx_projects_user_status (user_id, status),
  INDEX idx_projects_user_deleted (user_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 5. WORK SESSIONS & PAUSES
-- =============================================
CREATE TABLE IF NOT EXISTS work_sessions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  project_id       INT NOT NULL,
  user_id          INT NOT NULL,
  title            VARCHAR(255) NOT NULL DEFAULT 'Work session',
  type             ENUM('meeting','call','discussion','planning','proposal','travel','production','revision','delivery','other') NOT NULL DEFAULT 'other',
  payment_type     ENUM('unpaid','paid','intentional_unpaid') NOT NULL DEFAULT 'unpaid',
  unpaid_reason    ENUM('learning','portfolio','charity','strategic','personal','client_work') DEFAULT NULL,
  notes            TEXT DEFAULT NULL,
  started_at       DATETIME(3) NOT NULL,
  ended_at         DATETIME(3) DEFAULT NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  paused_seconds   INT NOT NULL DEFAULT 0,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at       DATETIME(3) DEFAULT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (user_id)    REFERENCES users(id),
  INDEX idx_sessions_user_id (user_id),
  INDEX idx_sessions_project_id (project_id),
  INDEX idx_sessions_user_started (user_id, started_at),
  INDEX idx_sessions_user_payment (user_id, payment_type),
  INDEX idx_sessions_user_deleted (user_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS work_session_pauses (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  work_session_id        INT NOT NULL,
  paused_at              DATETIME(3) NOT NULL,
  resumed_at             DATETIME(3) DEFAULT NULL,
  pause_duration_seconds INT NOT NULL DEFAULT 0,
  created_at             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (work_session_id) REFERENCES work_sessions(id) ON DELETE CASCADE,
  INDEX idx_pauses_session (work_session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 6. PAYMENTS & EXPENSES
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  project_id    INT NOT NULL,
  client_id     INT DEFAULT NULL,
  amount        DECIMAL(19,4) NOT NULL,
  currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
  paid_date     DATE NOT NULL,
  notes         TEXT DEFAULT NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at    DATETIME(3) DEFAULT NULL,
  FOREIGN KEY (user_id)    REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (client_id)  REFERENCES clients(id) ON DELETE SET NULL,
  INDEX idx_payments_user_id (user_id),
  INDEX idx_payments_project_id (project_id),
  INDEX idx_payments_user_date (user_id, paid_date),
  INDEX idx_payments_user_deleted (user_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_expenses (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  project_id    INT NOT NULL,
  description   VARCHAR(255) NOT NULL,
  category      VARCHAR(50) NOT NULL DEFAULT 'General',
  amount        DECIMAL(19,4) NOT NULL,
  currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
  expense_date  DATE NOT NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at    DATETIME(3) DEFAULT NULL,
  FOREIGN KEY (user_id)    REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  INDEX idx_expenses_user_id (user_id),
  INDEX idx_expenses_project_id (project_id),
  INDEX idx_expenses_user_date (user_id, expense_date),
  INDEX idx_expenses_user_deleted (user_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS overhead_expenses (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  description      VARCHAR(255) NOT NULL,
  category         VARCHAR(50) NOT NULL DEFAULT 'General',
  amount           DECIMAL(19,4) NOT NULL,
  currency         VARCHAR(3) NOT NULL DEFAULT 'USD',
  expense_date     DATE NOT NULL,
  is_recurring     BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_period ENUM('monthly','quarterly','annual') DEFAULT NULL,
  notes            TEXT DEFAULT NULL,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at       DATETIME(3) DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_overhead_user_id (user_id),
  INDEX idx_overhead_user_date (user_id, expense_date),
  INDEX idx_overhead_user_deleted (user_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS income_sources (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  name       VARCHAR(150) NOT NULL,
  type       ENUM('retainer','consulting','royalty','product','salary','other') NOT NULL DEFAULT 'other',
  amount     DECIMAL(19,4) NOT NULL,
  currency   VARCHAR(3) NOT NULL DEFAULT 'USD',
  frequency  ENUM('one_off','weekly','monthly','quarterly','annual') NOT NULL DEFAULT 'monthly',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  notes      TEXT DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_income_sources_user_id (user_id),
  INDEX idx_income_sources_active (user_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fx_rates (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  rate_date      DATE NOT NULL,
  base_currency  VARCHAR(3) NOT NULL,
  quote_currency VARCHAR(3) NOT NULL,
  rate           DECIMAL(19,6) NOT NULL,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_fx_date_base_quote (rate_date, base_currency, quote_currency),
  INDEX idx_fx_pair (base_currency, quote_currency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_quotes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  project_id   INT NOT NULL,
  version      INT NOT NULL DEFAULT 1,
  quote_amount DECIMAL(19,4) NOT NULL,
  currency     VARCHAR(3) NOT NULL DEFAULT 'USD',
  est_hours    DECIMAL(8,2) DEFAULT NULL,
  quote_date   DATE NOT NULL,
  valid_until  DATE DEFAULT NULL,
  status       ENUM('draft','sent','accepted','rejected','superseded') NOT NULL DEFAULT 'draft',
  notes        TEXT DEFAULT NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at   DATETIME(3) DEFAULT NULL,
  FOREIGN KEY (user_id)    REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  INDEX idx_quotes_user_id (user_id),
  INDEX idx_quotes_project_version (project_id, version),
  INDEX idx_quotes_user_deleted (user_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 7. INVOICING MODULE
-- =============================================
CREATE TABLE IF NOT EXISTS invoices (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT NOT NULL,
  project_id          INT DEFAULT NULL,
  client_id           INT DEFAULT NULL,
  invoice_number      VARCHAR(100) NOT NULL,
  invoice_date        DATE NOT NULL,
  due_date            DATE NOT NULL,
  customer_name       VARCHAR(200) NOT NULL,
  customer_email      VARCHAR(255) DEFAULT NULL,
  customer_contact    VARCHAR(100) DEFAULT NULL,
  customer_address    TEXT DEFAULT NULL,
  service_description TEXT DEFAULT NULL,
  currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
  seller_name         VARCHAR(200) DEFAULT NULL,
  seller_logo         TEXT DEFAULT NULL,
  seller_address      TEXT DEFAULT NULL,
  seller_email        VARCHAR(255) DEFAULT NULL,
  seller_phone        VARCHAR(50) DEFAULT NULL,
  seller_tax_id       VARCHAR(100) DEFAULT NULL,
  subtotal            DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  discount            DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  tax_percent         DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  tax_amount          DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  total               DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  notes               TEXT DEFAULT NULL,
  status              ENUM('DRAFT','SENT','PAID','OVERDUE','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  paid_at             DATETIME(3) DEFAULT NULL,
  created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at          DATETIME(3) DEFAULT NULL,
  FOREIGN KEY (user_id)    REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id)  REFERENCES clients(id) ON DELETE SET NULL,
  UNIQUE KEY uq_user_invoice_number (user_id, invoice_number),
  INDEX idx_invoices_user_id (user_id),
  INDEX idx_invoices_user_status (user_id, status),
  INDEX idx_invoices_user_date (user_id, invoice_date),
  INDEX idx_invoices_user_deleted (user_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_items (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id    INT NOT NULL,
  description   VARCHAR(255) NOT NULL,
  quantity      DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  unit_price    DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  amount        DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  display_order INT NOT NULL DEFAULT 0,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  INDEX idx_items_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_taxes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id  INT NOT NULL,
  tax_name    VARCHAR(50) NOT NULL,
  tax_percent DECIMAL(5,2) NOT NULL,
  tax_amount  DECIMAL(19,4) NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  INDEX idx_taxes_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_sequences (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  prefix      VARCHAR(20) NOT NULL DEFAULT 'INV',
  year        INT NOT NULL,
  next_number INT NOT NULL DEFAULT 1,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_user_prefix_year (user_id, prefix, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 8. AUTHENTICATION & SECURITY
-- =============================================
CREATE TABLE IF NOT EXISTS otp_codes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  email        VARCHAR(255) NOT NULL,
  code_hash    VARCHAR(255) NOT NULL,
  purpose      ENUM('login','register','email_change','password_reset') NOT NULL DEFAULT 'login',
  name         VARCHAR(150) DEFAULT NULL,
  attempts     INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  expires_at   DATETIME(3) NOT NULL,
  consumed_at  DATETIME(3) DEFAULT NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_otp_email_purpose (email, purpose),
  INDEX idx_otp_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  token_hash   VARCHAR(255) UNIQUE NOT NULL,
  user_id      INT NOT NULL,
  user_agent   TEXT DEFAULT NULL,
  ip_address   VARCHAR(45) DEFAULT NULL,
  device_info  VARCHAR(150) DEFAULT NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at   DATETIME(3) NOT NULL,
  revoked_at   DATETIME(3) DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_sessions_user_id (user_id),
  INDEX idx_sessions_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 9. PLATFORM, STORE & MONETIZATION
-- =============================================
CREATE TABLE IF NOT EXISTS addons (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  slug           VARCHAR(100) UNIQUE NOT NULL,
  name           VARCHAR(150) NOT NULL,
  description    TEXT DEFAULT NULL,
  icon           VARCHAR(50) NOT NULL DEFAULT 'IconPackage',
  version        VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  category       VARCHAR(50) NOT NULL DEFAULT 'Utilities',
  features       JSON DEFAULT NULL,
  is_free        BOOLEAN NOT NULL DEFAULT TRUE,
  price_amount   DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  price_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status         ENUM('PUBLISHED','DRAFT','ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
  display_order  INT NOT NULL DEFAULT 0,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_addons_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_addons (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  addon_id     INT NOT NULL,
  status       ENUM('INSTALLED','ACTIVATED','DISABLED','UNINSTALLED') NOT NULL DEFAULT 'ACTIVATED',
  activated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_used_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  usage_count  INT NOT NULL DEFAULT 0,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id)  REFERENCES users(id),
  FOREIGN KEY (addon_id) REFERENCES addons(id),
  UNIQUE KEY uq_user_addon (user_id, addon_id),
  INDEX idx_user_addons_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plans (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  plan_key         VARCHAR(50) UNIQUE NOT NULL,
  name             VARCHAR(100) NOT NULL,
  description      TEXT DEFAULT NULL,
  price_amount     DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  currency         VARCHAR(3) NOT NULL DEFAULT 'USD',
  billing_interval ENUM('monthly','annual','lifetime','free') NOT NULL DEFAULT 'monthly',
  features         JSON DEFAULT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_plans_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  user_id              INT NOT NULL,
  plan_id              INT NOT NULL,
  status               ENUM('trialing','active','past_due','canceled','incomplete','expired') NOT NULL DEFAULT 'active',
  current_period_start DATETIME(3) NOT NULL,
  current_period_end   DATETIME(3) NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at          DATETIME(3) DEFAULT NULL,
  payment_method       VARCHAR(50) DEFAULT NULL,
  external_sub_id      VARCHAR(150) DEFAULT NULL,
  created_at           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES plans(id),
  INDEX idx_sub_user_status (user_id, status),
  INDEX idx_sub_period_end (current_period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_events (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  subscription_id INT DEFAULT NULL,
  event_type      VARCHAR(50) NOT NULL,
  amount          DECIMAL(19,4) NOT NULL,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  status          ENUM('succeeded','failed','pending','refunded') NOT NULL DEFAULT 'succeeded',
  payload         JSON DEFAULT NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id)         REFERENCES users(id),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  INDEX idx_billing_user (user_id),
  INDEX idx_billing_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  metadata   JSON DEFAULT NULL,
  read_at    DATETIME(3) DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_notif_user_read (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  channel    ENUM('email','in_app','sms') NOT NULL DEFAULT 'email',
  topic      VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_user_channel_topic (user_id, channel, topic)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 10. ADMIN, OPERATIONS & AUDIT TRAIL
-- =============================================
CREATE TABLE IF NOT EXISTS category_requests (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT DEFAULT NULL,
  user_email     VARCHAR(255) NOT NULL,
  requested_name VARCHAR(150) NOT NULL,
  description    TEXT DEFAULT NULL,
  reason         TEXT DEFAULT NULL,
  status         ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED','MERGED') NOT NULL DEFAULT 'PENDING',
  admin_notes    TEXT DEFAULT NULL,
  processed_by   VARCHAR(255) DEFAULT NULL,
  processed_at   DATETIME(3) DEFAULT NULL,
  request_count  INT NOT NULL DEFAULT 1,
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_cat_requests_status (status),
  INDEX idx_cat_requests_email (user_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  role_key    VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_permissions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  permission_key VARCHAR(100) UNIQUE NOT NULL,
  module         VARCHAR(50) NOT NULL,
  name           VARCHAR(100) NOT NULL,
  description    TEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_key       VARCHAR(50) NOT NULL,
  permission_key VARCHAR(100) NOT NULL,
  PRIMARY KEY (role_key, permission_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  role_key   VARCHAR(50) NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_admin_users_role (role_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_templates (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  template_key VARCHAR(100) UNIQUE NOT NULL,
  name         VARCHAR(150) NOT NULL,
  subject      VARCHAR(255) NOT NULL,
  body_html    TEXT NOT NULL,
  body_text    TEXT DEFAULT NULL,
  variables    JSON DEFAULT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_logs (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  recipient       VARCHAR(255) NOT NULL,
  template_key    VARCHAR(100) DEFAULT NULL,
  subject         VARCHAR(255) NOT NULL,
  status          ENUM('sent','failed','pending') NOT NULL DEFAULT 'sent',
  provider_msg_id VARCHAR(150) DEFAULT NULL,
  error_message   TEXT DEFAULT NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_email_recipient (recipient),
  INDEX idx_email_status (status),
  INDEX idx_email_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_email VARCHAR(255) NOT NULL,
  action      VARCHAR(100) NOT NULL,
  module      VARCHAR(50) NOT NULL,
  target      VARCHAR(255) DEFAULT NULL,
  prev_value  TEXT DEFAULT NULL,
  new_value   TEXT DEFAULT NULL,
  ip_address  VARCHAR(45) DEFAULT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_audit_admin_email (admin_email),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  metadata   JSON DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_admin_notif_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_events (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT DEFAULT NULL,
  email      VARCHAR(255) DEFAULT NULL,
  event_name VARCHAR(100) NOT NULL,
  stage      VARCHAR(50) DEFAULT NULL,
  metadata   JSON DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_events_name (event_name),
  INDEX idx_events_stage (stage),
  INDEX idx_events_created_at (created_at),
  INDEX idx_events_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS analytics_daily_rollups (
  id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
  rollup_date        DATE NOT NULL,
  metric_key         VARCHAR(100) NOT NULL,
  dimension_key      VARCHAR(100) NOT NULL DEFAULT 'overall',
  dimension_value    VARCHAR(150) NOT NULL DEFAULT 'all',
  metric_value       DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
  unique_users_count INT NOT NULL DEFAULT 0,
  events_count       INT NOT NULL DEFAULT 0,
  metadata           JSON DEFAULT NULL,
  created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_daily_rollup (rollup_date, metric_key, dimension_key, dimension_value),
  INDEX idx_rollups_date (rollup_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
