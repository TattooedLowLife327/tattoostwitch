-- =====================================================
-- NEON DATABASE SCHEMA FOR STREAM OVERLAY SYSTEM
-- =====================================================
-- Run this in your Neon DB console to set up all tables

-- =====================================================
-- SONG REQUEST QUEUE
-- =====================================================
CREATE TABLE IF NOT EXISTS song_requests (
  id SERIAL PRIMARY KEY,
  spotify_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  artist VARCHAR(500) NOT NULL,
  album_art TEXT,
  requester VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'playing', 'completed')),
  uri VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_song_requests_status ON song_requests(status);
CREATE INDEX idx_song_requests_created ON song_requests(created_at DESC);

-- =====================================================
-- CURRENT TRACK (what's playing now)
-- =====================================================
CREATE TABLE IF NOT EXISTS current_track (
  id INT PRIMARY KEY DEFAULT 1,
  spotify_id VARCHAR(255),
  title VARCHAR(500),
  artist VARCHAR(500),
  album VARCHAR(500),
  album_art TEXT,
  requester VARCHAR(100),
  playlist_name VARCHAR(500),
  progress_ms INT DEFAULT 0,
  duration_ms INT DEFAULT 0,
  is_playing BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO current_track (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SCOREBOARD
-- =====================================================
CREATE TABLE IF NOT EXISTS scoreboard_state (
  id INT PRIMARY KEY DEFAULT 1,
  player1_name VARCHAR(100) DEFAULT 'TATTOO',
  player1_score INT DEFAULT 0,
  player2_name VARCHAR(100) DEFAULT 'OPEN',
  player2_score INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO scoreboard_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STREAM MODE
-- =====================================================
CREATE TABLE IF NOT EXISTS stream_config (
  id INT PRIMARY KEY DEFAULT 1,
  current_mode VARCHAR(20) DEFAULT 'tourney' CHECK (current_mode IN ('tourney', 'lobby', 'cash')),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO stream_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SCREEN OVERLAYS (BRB, Tech Difficulties, etc)
-- =====================================================
CREATE TABLE IF NOT EXISTS screen_overlay (
  id INT PRIMARY KEY DEFAULT 1,
  overlay_type VARCHAR(50), -- 'brb', 'tech_difficulties', 'starting_soon', 'ending'
  is_active BOOLEAN DEFAULT false,
  duration_minutes INT,
  start_time TIMESTAMP,
  custom_message TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO screen_overlay (id, is_active) VALUES (1, false) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- USER ACTIVITY TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS user_activity (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  last_seen TIMESTAMP DEFAULT NOW(),
  first_seen TIMESTAMP DEFAULT NOW(),
  total_messages INT DEFAULT 1
);

CREATE UNIQUE INDEX idx_user_activity_username ON user_activity(LOWER(username));

-- =====================================================
-- SETTINGS
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
  ('promo_minutes', '15', 'Minutes between automatic promo messages'),
  ('special_users', '', 'Comma-separated list of special users to announce'),
  ('song_request_enabled', 'true', 'Enable/disable song requests'),
  ('max_requests_per_user', '3', 'Maximum pending requests per user'),
  ('auto_approve_threshold_minutes', '0', 'Auto-approve songs shorter than X minutes (0 = disabled)')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- ACTIVITY LOG (for debugging/analytics)
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  username VARCHAR(100),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_type ON activity_log(event_type);

-- =====================================================
-- HELPER FUNCTION: Log Activity
-- =====================================================
CREATE OR REPLACE FUNCTION log_activity(
  p_event_type VARCHAR(50),
  p_username VARCHAR(100) DEFAULT NULL,
  p_details JSONB DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO activity_log (event_type, username, details)
  VALUES (p_event_type, p_username, p_details);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- HELPER FUNCTION: Update User Activity
-- =====================================================
CREATE OR REPLACE FUNCTION update_user_activity(p_username VARCHAR(100))
RETURNS void AS $$
BEGIN
  INSERT INTO user_activity (username, last_seen, first_seen, total_messages)
  VALUES (p_username, NOW(), NOW(), 1)
  ON CONFLICT (LOWER(username))
  DO UPDATE SET
    last_seen = NOW(),
    total_messages = user_activity.total_messages + 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CLEANUP: Delete old activity logs (keep 30 days)
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM activity_log
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a cron job to run cleanup weekly
-- (Requires pg_cron extension - uncomment if available)
-- SELECT cron.schedule('cleanup-logs', '0 0 * * 0', 'SELECT cleanup_old_logs()');

-- =====================================================
-- ADMIN USERS (for control panel access)
-- =====================================================
CREATE TABLE IF NOT EXISTS admins (
  pin VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  color VARCHAR(7) DEFAULT '#8b5cf6',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add your owner account for control panel access
-- IMPORTANT: Replace 'YOUR_PIN_HERE' with your actual PIN before running
-- INSERT INTO admins (pin, name, role, color)
-- VALUES ('YOUR_PIN_HERE', 'Owner', 'owner', '#8b5cf6')
-- ON CONFLICT (pin) DO NOTHING;

-- Migration: Add color column to existing admins table (run this if table already exists)
-- ALTER TABLE admins ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#8b5cf6';
