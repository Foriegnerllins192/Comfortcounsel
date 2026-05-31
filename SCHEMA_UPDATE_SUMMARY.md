# Schema Update Summary - Subscription Tiers

## ✅ What's Been Added

### New Fields in `counselors` Table:
1. **`subscription_tier`** - VARCHAR(20), values: 'basic', 'standard', 'premium'
2. **`commission_rate`** - NUMERIC(5,2), stores the commission percentage (20.00 or 15.00)
3. **`verification_fee_paid`** - BOOLEAN, tracks if verification fee was paid
4. **`verification_payment_reference`** - VARCHAR(255), stores Paystack payment reference

### New Tables:

#### 1. `verification_payments`
Tracks one-time verification fee payments for Standard (GHS 500) and Premium (GHS 700) tiers.

```sql
- id
- counselor_id
- amount (500.00 or 700.00)
- tier ('standard' or 'premium')
- payment_reference (from Paystack)
- payment_status ('pending', 'success', 'failed')
- paid_at
- created_at
```

#### 2. `platform_commissions`
Tracks commission from each completed session.

```sql
- id
- session_id
- counselor_id
- session_amount (what client paid)
- commission_rate (counselor's rate: 20% or 15%)
- commission_amount (platform's cut)
- counselor_earnings (what counselor receives)
- status ('pending', 'collected', 'paid_to_counselor')
- created_at
```

## 💰 Subscription Tier Breakdown

| Tier | Verification Fee | Platform Commission | Counselor Keeps |
|------|-----------------|-------------------|----------------|
| **Basic** | GHS 0 (Free) | 20% | 80% |
| **Standard** | GHS 500 (one-time) | 15% | 85% |
| **Premium** | GHS 700 (one-time) | 15% | 85% |

## 📊 Example Calculations

### Basic Tier (20% commission):
- Client pays: GHS 100
- Platform takes: GHS 20
- Counselor receives: GHS 80

### Standard/Premium Tier (15% commission):
- Client pays: GHS 100
- Platform takes: GHS 15
- Counselor receives: GHS 85

## 🎯 Sample Data Included

The schema now includes 6 counselors with different tiers:

1. **Dr. Sarah Owusu** - Premium (paid GHS 700, 15% commission)
2. **Michael Appiah** - Standard (paid GHS 500, 15% commission)
3. **Grace Mensah** - Premium (paid GHS 700, 15% commission)
4. **Dr. Emmanuel Boateng** - Basic (free, 20% commission)
5. **Abena Osei** - Standard (paid GHS 500, 15% commission)
6. **Dr. Kwabena Asare** - Premium (paid GHS 700, 15% commission)

## 🚀 How to Apply the Update

### Option 1: Neon SQL Editor (Easiest)
1. Go to https://console.neon.tech
2. Open SQL Editor
3. Copy entire `schema.sql` file
4. Paste and click "Run"
5. Done! ✅

### Option 2: Command Line
```bash
cd comfort-counsel
psql "your-database-url" -f schema.sql
```

## 🔍 Verify the Update

After running the schema, check:

```sql
-- Check counselors have tier info
SELECT 
  u.name, 
  c.subscription_tier, 
  c.commission_rate, 
  c.verification_fee_paid 
FROM counselors c 
JOIN users u ON c.user_id = u.id;
```

Expected output:
```
name                    | subscription_tier | commission_rate | verification_fee_paid
------------------------|-------------------|-----------------|---------------------
Dr. Sarah Owusu        | premium           | 15.00           | true
Michael Appiah         | standard          | 15.00           | true
Grace Mensah           | premium           | 15.00           | true
Dr. Emmanuel Boateng   | basic             | 20.00           | false
Abena Osei             | standard          | 15.00           | true
Dr. Kwabena Asare      | premium           | 15.00           | true
```

## 📝 What This Enables

### For Counselors:
✅ Can see their current tier in dashboard
✅ Can upgrade from Basic → Standard or Premium
✅ Pay one-time verification fee via Paystack
✅ Automatically get lower commission rate (15% vs 20%)
✅ Get verified badge on profile

### For Platform:
✅ Track verification fee revenue
✅ Track commission revenue per session
✅ Calculate earnings based on counselor tier
✅ Generate revenue reports by tier
✅ Automatically apply correct commission rate

### For Clients:
✅ See verified badges on counselor profiles
✅ Know which counselors are verified
✅ Trust premium/standard counselors more

## 🎨 Next Implementation Steps

1. **Add tier badges to counselor profiles** (Basic/Standard/Premium)
2. **Create upgrade page** in counselor dashboard
3. **Integrate Paystack** for verification payments
4. **Update commission calculation** in payment flow
5. **Add admin dashboard** to view revenue by tier

## 📚 Documentation

- **Full Guide**: See `SUBSCRIPTION_TIERS_GUIDE.md`
- **Setup Guide**: See `DATABASE_SETUP_WITH_SAMPLE_DATA.md`
- **Schema File**: `schema.sql`

---

**Ready to upload!** Your schema now supports the complete subscription tier system with automatic commission calculation. 🎉
