# 🚀 Quick Reference: Subscription Tiers

## At a Glance

| Feature | Basic | Standard | Premium |
|---------|-------|----------|---------|
| **Verification Fee** | GHS 0 | GHS 500 | GHS 700 |
| **Platform Commission** | 20% | 15% | 15% |
| **Counselor Keeps** | 80% | 85% | 85% |
| **Badge** | Basic | ✓ Verified | ★ Premium |
| **Listing Priority** | Normal | Priority | Top |

## Quick Calculations

### Client pays GHS 100:
- **Basic**: Platform GHS 20, Counselor GHS 80
- **Standard**: Platform GHS 15, Counselor GHS 85
- **Premium**: Platform GHS 15, Counselor GHS 85

### Client pays GHS 200:
- **Basic**: Platform GHS 40, Counselor GHS 160
- **Standard**: Platform GHS 30, Counselor GHS 170
- **Premium**: Platform GHS 30, Counselor GHS 170

## Database Fields

```sql
-- In counselors table:
subscription_tier        -- 'basic', 'standard', 'premium'
commission_rate          -- 20.00 or 15.00
verification_fee_paid    -- TRUE or FALSE
```

## Key Queries

### Get counselor with tier:
```sql
SELECT u.name, c.subscription_tier, c.commission_rate 
FROM counselors c 
JOIN users u ON c.user_id = u.id 
WHERE c.id = $1;
```

### Calculate commission:
```javascript
const commissionAmount = sessionAmount * (commissionRate / 100);
const counselorEarnings = sessionAmount - commissionAmount;
```

### Upgrade counselor:
```sql
UPDATE counselors 
SET subscription_tier = 'standard',
    commission_rate = 15.00,
    verification_fee_paid = TRUE
WHERE id = $1;
```

## Files Created

1. **schema.sql** - Updated database schema
2. **SUBSCRIPTION_TIERS_GUIDE.md** - Complete implementation guide
3. **DATABASE_SETUP_WITH_SAMPLE_DATA.md** - Setup instructions
4. **SCHEMA_UPDATE_SUMMARY.md** - What changed
5. **TIER_SYSTEM_VISUAL.md** - Visual diagrams
6. **QUICK_REFERENCE_TIERS.md** - This file

## Next Steps

1. ✅ Upload schema.sql to Neon
2. ⏳ Implement upgrade endpoint
3. ⏳ Add tier badges to UI
4. ⏳ Integrate Paystack payments
5. ⏳ Update commission calculation

---
**Ready to go!** 🎉
