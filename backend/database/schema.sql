-- Wello Database Schema
-- Work Value & Income Management

CREATE DATABASE IF NOT EXISTS wello CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wello;

-- =============================================
-- USERS (Profile / Settings)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  avatar_initials VARCHAR(4),
  target_hourly   DECIMAL(12,2) DEFAULT NULL,
  currency        VARCHAR(10) DEFAULT '₹',
  status          ENUM('REGISTERED','EMAIL_PENDING','VERIFICATION_PENDING','VERIFIED','ACTIVE','INACTIVE','SUSPENDED','BLOCKED') DEFAULT 'ACTIVE',
  role            ENUM('user','admin') DEFAULT 'user',
  country         VARCHAR(100) DEFAULT 'India',
  state           VARCHAR(100) DEFAULT 'Maharashtra',
  city            VARCHAR(100) DEFAULT 'Mumbai',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================
-- CLIENTS
-- =============================================
CREATE TABLE IF NOT EXISTS clients (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(200) NOT NULL,
  email       VARCHAR(255),
  phone       VARCHAR(50),
  company     VARCHAR(200),
  notes       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- PROJECTS
-- =============================================
CREATE TABLE IF NOT EXISTS projects (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  client_id       INT,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  service_category VARCHAR(100),
  status          ENUM('potential','quoted','approved','in_progress','completed','lost') DEFAULT 'potential',
  is_job          BOOLEAN DEFAULT FALSE,
  quote_amount    DECIMAL(14,2),
  quote_date      DATE,
  quote_est_hours DECIMAL(8,2),
  quote_notes     TEXT,
  quote_status    ENUM('draft','sent','accepted','rejected') DEFAULT 'draft',
  revenue         DECIMAL(14,2) DEFAULT 0.00,
  expenses        DECIMAL(14,2) DEFAULT 0.00,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- =============================================
-- WORK SESSIONS
-- =============================================
CREATE TABLE IF NOT EXISTS work_sessions (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  project_id   INT NOT NULL,
  user_id      INT NOT NULL,
  title        VARCHAR(255) NOT NULL DEFAULT 'Work session',
  type         ENUM('meeting','call','discussion','planning','proposal','travel','production','revision','delivery','other') DEFAULT 'other',
  payment_type ENUM('unpaid','paid','intentional_unpaid') DEFAULT 'unpaid',
  unpaid_reason ENUM('learning','portfolio','charity','strategic','personal','client_work') DEFAULT NULL,
  notes        TEXT,
  started_at   DATETIME NOT NULL,
  ended_at     DATETIME,
  duration_min INT GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
    THEN TIMESTAMPDIFF(MINUTE, started_at, ended_at)
    ELSE NULL END
  ) STORED,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- PAYMENTS & EXPENSES
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  amount     DECIMAL(14,2) NOT NULL,
  paid_date  DATE NOT NULL,
  notes      TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_expenses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  project_id  INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount      DECIMAL(14,2) NOT NULL,
  expense_date DATE NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- =============================================
-- ADMIN RBAC (Roles & Permissions)
-- =============================================
CREATE TABLE IF NOT EXISTS admin_roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  role_key    VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  permission_key VARCHAR(100) UNIQUE NOT NULL,
  module         VARCHAR(50) NOT NULL,
  name           VARCHAR(100) NOT NULL,
  description    TEXT
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_key       VARCHAR(50) NOT NULL,
  permission_key VARCHAR(100) NOT NULL,
  PRIMARY KEY (role_key, permission_key)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  role_key    VARCHAR(50) NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- ANALYTICS EVENT ENGINE
-- =============================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  email       VARCHAR(255),
  event_name  VARCHAR(100) NOT NULL,
  stage       VARCHAR(50),
  metadata    JSON,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_events_name (event_name),
  INDEX idx_events_stage (stage),
  INDEX idx_events_date (created_at)
);

-- =============================================
-- CATEGORIES & USER CATEGORY REQUESTS
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  parent_id     INT DEFAULT NULL,
  name          VARCHAR(150) NOT NULL,
  slug          VARCHAR(150) UNIQUE NOT NULL,
  description   TEXT,
  icon          VARCHAR(50) DEFAULT 'IconBriefcase',
  display_order INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS category_requests (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT,
  user_email     VARCHAR(255) NOT NULL,
  requested_name VARCHAR(150) NOT NULL,
  description    TEXT,
  reason         TEXT,
  status         ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED','MERGED') DEFAULT 'PENDING',
  admin_notes    TEXT,
  processed_by   VARCHAR(255),
  processed_at   DATETIME,
  count          INT DEFAULT 1,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- COMMUNICATIONS (Email Templates & Logs)
-- =============================================
CREATE TABLE IF NOT EXISTS email_templates (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  template_key VARCHAR(100) UNIQUE NOT NULL,
  name         VARCHAR(150) NOT NULL,
  subject      VARCHAR(255) NOT NULL,
  body_html    TEXT NOT NULL,
  body_text    TEXT,
  variables    JSON,
  is_active    BOOLEAN DEFAULT TRUE,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_logs (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  recipient       VARCHAR(255) NOT NULL,
  template_key    VARCHAR(100),
  subject         VARCHAR(255) NOT NULL,
  status          ENUM('sent','failed','pending') DEFAULT 'sent',
  provider_msg_id VARCHAR(150),
  error_message   TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_recipient (recipient),
  INDEX idx_email_status (status)
);

-- =============================================
-- AUDIT LOGS & NOTIFICATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_email VARCHAR(255) NOT NULL,
  action      VARCHAR(100) NOT NULL,
  module      VARCHAR(50) NOT NULL,
  target      VARCHAR(255),
  prev_value  TEXT,
  new_value   TEXT,
  ip_address  VARCHAR(45),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_action (action),
  INDEX idx_audit_date (created_at)
);

CREATE TABLE IF NOT EXISTS admin_notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT FALSE,
  metadata   JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX idx_projects_user   ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_sessions_project ON work_sessions(project_id);
CREATE INDEX idx_sessions_started ON work_sessions(started_at);
CREATE INDEX idx_payments_project ON payments(project_id);
