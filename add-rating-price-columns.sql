-- Add rating and price columns to counselors table

-- Add rating column (default 0.0, range 0-5)
ALTER TABLE counselors 
ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5);

-- Add price column (session price in GHS)
ALTER TABLE counselors 
ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 80.00;

-- Update existing counselors with default prices based on tier
UPDATE counselors 
SET price = CASE 
  WHEN subscription_tier = 'basic' THEN 80.00
  WHEN subscription_tier = 'standard' THEN 150.00
  WHEN subscription_tier = 'premium' THEN 250.00
  ELSE 80.00
END
WHERE price IS NULL OR price = 0;

-- Add indexes for filtering
CREATE INDEX IF NOT EXISTS idx_counselors_rating ON counselors(rating);
CREATE INDEX IF NOT EXISTS idx_counselors_price ON counselors(price);

-- Display updated counselors
SELECT id, user_id, category, subscription_tier, rating, price, status 
FROM counselors 
ORDER BY id;
