-- Wello Database Schema
-- Work Value & Income Management

CREATE DATABASE IF NOT EXISTS wello CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wello;

-- =============================================
-- USERS (Profile / Settings)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  avatar_initials VARCHAR(4),
  target_hourly DECIMAL(12,2) DEFAULT NULL,
  currency      VARCHAR(10) DEFAULT '₹',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
-- PAYMENTS
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

-- =============================================
-- EXPENSES
-- =============================================
CREATE TABLE IF NOT EXISTS project_expenses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  project_id  INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount      DECIMAL(14,2) NOT NULL,
  expense_date DATE NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- INDEXES
CREATE INDEX idx_projects_user   ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_sessions_project ON work_sessions(project_id);
CREATE INDEX idx_sessions_started ON work_sessions(started_at);
CREATE INDEX idx_payments_project ON payments(project_id);
