-- ============================================================
-- COMFORT COUNSEL - DATABASE MIGRATIONS
-- Run ALL of these in your Neon SQL editor
-- ============================================================

-- 1. Add session_duration to counselors (default 45 minutes)
ALTER TABLE counselors ADD COLUMN IF NOT EXISTS session_duration INTEGER DEFAULT 45;

-- 2. Add profile_picture to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- 3. Add rating and price columns to counselors if missing
ALTER TABLE counselors ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0;
ALTER TABLE counselors ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 80;

-- 4. Verify everything looks good
SELECT 
  c.id,
  u.name,
  c.category,
  c.session_duration,
  c.price,
  c.rating,
  u.profile_picture
FROM counselors c
JOIN users u ON c.user_id = u.id
LIMIT 5;
