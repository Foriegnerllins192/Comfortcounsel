-- Verify and Update Counselor Prices
-- Run this script to ensure all counselors have valid prices set

-- 1. Check if price column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'counselors' AND column_name = 'price';

-- 2. Check current counselor prices
SELECT id, user_id, category, subscription_tier, price, commission_rate, status 
FROM counselors 
ORDER BY id;

-- 3. Update any NULL or zero prices with tier-based defaults
UPDATE counselors 
SET price = CASE 
  WHEN subscription_tier = 'basic' THEN 80.00
  WHEN subscription_tier = 'standard' THEN 150.00
  WHEN subscription_tier = 'premium' THEN 250.00
  ELSE 80.00
END
WHERE price IS NULL OR price = 0 OR price < 50;

-- 4. Verify all counselors now have valid prices
SELECT id, user_id, category, subscription_tier, price, commission_rate, status 
FROM counselors 
WHERE price IS NULL OR price < 50
ORDER BY id;

-- 5. Check if session_amount column exists in sessions table
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'sessions' AND column_name = 'session_amount';

-- 6. If session_amount column doesn't exist, add it
-- ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_amount NUMERIC(10,2);

-- 7. Display summary
SELECT 
  subscription_tier,
  COUNT(*) as counselor_count,
  MIN(price) as min_price,
  MAX(price) as max_price,
  AVG(price) as avg_price
FROM counselors
WHERE status = 'approved'
GROUP BY subscription_tier
ORDER BY subscription_tier;

-- 8. Test query: What the booking system will fetch
SELECT id, phone_number, price, commission_rate 
FROM counselors 
WHERE id = 1 AND status = 'approved';
