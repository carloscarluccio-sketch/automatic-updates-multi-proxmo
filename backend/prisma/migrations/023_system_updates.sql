-- Migration 023: System Updates and Version Management
-- This adds web-based update management functionality

-- System Updates Table
CREATE TABLE IF NOT EXISTS system_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version_from VARCHAR(50) NOT NULL,
  version_to VARCHAR(50) NOT NULL,
  update_type ENUM('major', 'minor', 'patch', 'hotfix') NOT NULL DEFAULT 'patch',
  status ENUM('pending', 'in_progress', 'completed', 'failed', 'rolled_back') NOT NULL DEFAULT 'pending',
  backup_file VARCHAR(500),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  duration_seconds INT,
  initiated_by INT NOT NULL,
  error_message TEXT,
  changelog TEXT,
  git_commit_hash VARCHAR(40),
  FOREIGN KEY (initiated_by) REFERENCES users(id),
  INDEX idx_status (status),
  INDEX idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System Info Table (singleton - only 1 row allowed)
CREATE TABLE IF NOT EXISTS system_info (
  id INT PRIMARY KEY DEFAULT 1,
  current_version VARCHAR(50) NOT NULL DEFAULT 'v1.7.0',
  git_commit_hash VARCHAR(40),
  last_update_check TIMESTAMP NULL,
  last_updated_at TIMESTAMP NULL,
  installation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  instance_id VARCHAR(100),
  instance_name VARCHAR(200),
  CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial system info (only if not exists)
INSERT INTO system_info (id, current_version, instance_id, instance_name)
SELECT 1, 'v1.7.0', UUID(), 'Production Instance'
WHERE NOT EXISTS (SELECT 1 FROM system_info WHERE id = 1);
