# Database Setup for Custom Pricing

## Quick Setup (Copy & Paste into Supabase SQL Editor)

### Step 1: Verify Price Column Exists

```sql
-- Check if price column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'counselors' AND column_name = 'price';
```

**Expected Result:** Should show `price | numeric | 80.00`

If the column doesn't exist, run:

```sql
-- Add price column
ALTER TABLE counselors 
ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 80.00;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_counselors_price ON counselors(price);
```

### Step 2: Set Default Prices for Existing Counselors

```sql
-- Update counselors with tier-based default prices
UPDATE counselors 
SET price = CASE 
  WHEN subscription_tier = 'basic' THEN 80.00
  WHEN subscription_tier = 'standard' THEN 150.00
  WHEN subscription_tier = 'premium' THEN 250.00
  ELSE 80.00
END
WHERE price IS NULL OR price = 0 OR price < 50;
```

### Step 3: Verify All Counselors Have Prices

```sql
-- Check all counselor prices
SELECT id, user_id, category, subscription_tier, price, commission_rate, status 
FROM counselors 
ORDER BY subscription_tier, price;
```

**Expected Result:** All counselors should have a price between 50 and 400.

### Step 4: Verify session_amount Column Exists

```sql
-- Check if session_amount column exists in sessions table
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'sessions' AND column_name = 'session_amount';
```

If it doesn't exist, run:

```sql
-- Add session_amount column to sessions table
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS session_amount NUMERIC(10,2);
```

### Step 5: View Price Summary by Tier

```sql
-- Summary of prices by tier
SELECT 
  subscription_tier,
  COUNT(*) as counselor_count,
  MIN(price) as min_price,
  MAX(price) as max_price,
  ROUND(AVG(price), 2) as avg_price
FROM counselors
WHERE status = 'approved'
GROUP BY subscription_tier
ORDER BY subscription_tier;
```

## Manual Price Updates

### Change a Specific Counselor's Price

```sql
-- Update counselor ID 1 to GHS 120
UPDATE counselors 
SET price = 120.00 
WHERE id = 1;
```

### Change All Basic Tier Counselors to GHS 90

```sql
UPDATE counselors 
SET price = 90.00 
WHERE subscription_tier = 'basic';
```

### Set Price Based on Experience

```sql
-- Set price based on years of experience
UPDATE counselors 
SET price = CASE 
  WHEN years_experience >= 15 THEN 200.00
  WHEN years_experience >= 10 THEN 150.00
  WHEN years_experience >= 5 THEN 100.00
  ELSE 80.00
END
WHERE subscription_tier = 'basic';
```

## Verification Queries

### Check Recent Sessions with Prices

```sql
-- View recent sessions with their prices
SELECT 
  s.id,
  s.session_amount,
  s.payment_status,
  s.session_status,
  c.price as counselor_price,
  u.name as counselor_name,
  s.created_at
FROM sessions s
JOIN counselors c ON s.counselor_id = c.id
JOIN users u ON c.user_id = u.id
ORDER BY s.created_at DESC
LIMIT 10;
```

### Check Revenue Splits

```sql
-- View revenue splits from completed sessions
SELECT 
  pc.session_id,
  pc.session_amount,
  pc.commission_rate,
  pc.commission_amount,
  pc.counselor_earnings,
  pc.status,
  pc.created_at
FROM platform_commissions pc
ORDER BY pc.created_at DESC
LIMIT 10;
```

### Find Counselors with Invalid Prices

```sql
-- Find counselors with prices outside valid range
SELECT id, user_id, category, subscription_tier, price, status
FROM counselors
WHERE price < 50 OR price > 1000 OR price IS NULL;
```

## Price Validation Rules

### Tier-Based Limits

| Tier | Min Price | Max Price | Commission Rate |
|------|-----------|-----------|-----------------|
| Basic | GHS 50 | GHS 100 | 20% |
| Standard | GHS 50 | GHS 250 | 15% |
| Premium | GHS 50 | GHS 400 | 15% |

### Enforce Tier Limits

```sql
-- Ensure all prices are within tier limits
UPDATE counselors 
SET price = CASE 
  WHEN subscription_tier = 'basic' AND price > 100 THEN 100.00
  WHEN subscription_tier = 'standard' AND price > 250 THEN 250.00
  WHEN subscription_tier = 'premium' AND price > 400 THEN 400.00
  WHEN price < 50 THEN 50.00
  ELSE price
END;
```

## Testing Queries

### Simulate a Booking

```sql
-- What the booking system will fetch for counselor ID 1
SELECT id, phone_number, price, commission_rate 
FROM counselors 
WHERE id = 1 AND status = 'approved';
```

### Calculate Revenue Split

```sql
-- Calculate what counselor and platform will earn
SELECT 
  id,
  price as session_price,
  commission_rate,
  ROUND(price * (commission_rate / 100), 2) as platform_commission,
  ROUND(price - (price * (commission_rate / 100)), 2) as counselor_earnings
FROM counselors
WHERE status = 'approved'
ORDER BY price DESC;
```

## Common Issues & Fixes

### Issue: Counselor has NULL price

```sql
-- Fix: Set default price based on tier
UPDATE counselors 
SET price = CASE 
  WHEN subscription_tier = 'premium' THEN 250.00
  WHEN subscription_tier = 'standard' THEN 150.00
  ELSE 80.00
END
WHERE price IS NULL;
```

### Issue: Price is too low (< 50)

```sql
-- Fix: Set minimum price to 50
UPDATE counselors 
SET price = 50.00 
WHERE price < 50;
```

### Issue: Price exceeds tier limit

```sql
-- Fix: Cap price at tier maximum
UPDATE counselors 
SET price = CASE 
  WHEN subscription_tier = 'basic' THEN LEAST(price, 100.00)
  WHEN subscription_tier = 'standard' THEN LEAST(price, 250.00)
  WHEN subscription_tier = 'premium' THEN LEAST(price, 400.00)
  ELSE 80.00
END
WHERE price > 100;
```

## Quick Reference

### View All Counselor Prices

```sql
SELECT 
  id,
  (SELECT name FROM users WHERE id = counselors.user_id) as name,
  category,
  subscription_tier,
  price,
  commission_rate,
  status
FROM counselors
ORDER BY price DESC;
```

### Update Your Own Price (as a counselor)

If you're logged in as a counselor and want to update your price directly:

```sql
-- Replace YOUR_USER_ID with your actual user ID
UPDATE counselors 
SET price = 120.00 
WHERE user_id = YOUR_USER_ID;
```

## Done! ✅

After running these queries, your database is ready for custom pricing. The backend code will automatically use these prices for all bookings and payments.
