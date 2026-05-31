# 🎯 Comfort Counsel Subscription Tiers - Visual Guide

## 📊 Tier Comparison

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION TIERS                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │    BASIC     │    │   STANDARD   │    │   PREMIUM    │          │
│  │              │    │              │    │              │          │
│  │   GHS 0      │    │   GHS 500    │    │   GHS 700    │          │
│  │   (Free)     │    │  (One-time)  │    │  (One-time)  │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                       │
│  Platform Takes:     Platform Takes:     Platform Takes:             │
│      20%                 15%                 15%                     │
│                                                                       │
│  Counselor Gets:     Counselor Gets:     Counselor Gets:             │
│      80%                 85%                 85%                     │
│                                                                       │
│  Features:           Features:           Features:                   │
│  • Basic listing     • ✓ Verified       • ★ Premium                 │
│  • All features      • Priority         • Top priority              │
│  • No upfront cost   • Lower rate       • Featured                  │
│                      • All Basic         • All Standard              │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## 💰 Commission Breakdown

### Example: Client Pays GHS 100 for Session

```
BASIC TIER (20% commission):
┌────────────────────────────────────┐
│ Client Pays:        GHS 100.00     │
├────────────────────────────────────┤
│ Platform Takes:     GHS  20.00 ⬅️  │
│ Counselor Receives: GHS  80.00 ⬅️  │
└────────────────────────────────────┘

STANDARD/PREMIUM TIER (15% commission):
┌────────────────────────────────────┐
│ Client Pays:        GHS 100.00     │
├────────────────────────────────────┤
│ Platform Takes:     GHS  15.00 ⬅️  │
│ Counselor Receives: GHS  85.00 ⬅️  │
└────────────────────────────────────┘

💡 Standard/Premium counselors earn GHS 5 more per GHS 100!
```

## 🔄 Upgrade Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    COUNSELOR UPGRADE JOURNEY                     │
└─────────────────────────────────────────────────────────────────┘

Step 1: Registration
   │
   ├─► New counselor registers
   │   • Default tier: BASIC
   │   • Commission rate: 20%
   │   • No verification fee
   │
   ▼

Step 2: Choose Upgrade (Optional)
   │
   ├─► Counselor clicks "Upgrade to Standard" or "Upgrade to Premium"
   │   • Standard: GHS 500
   │   • Premium: GHS 700
   │
   ▼

Step 3: Payment via Paystack
   │
   ├─► Paystack payment page opens
   │   • Counselor pays verification fee
   │   • Payment reference generated
   │
   ▼

Step 4: Verification
   │
   ├─► System verifies payment with Paystack
   │   • Records payment in verification_payments table
   │   • Updates counselor tier
   │
   ▼

Step 5: Tier Activated
   │
   └─► Counselor now has:
       • New tier (Standard or Premium)
       • Lower commission rate (15%)
       • Verified badge on profile
       • Priority listing
```

## 📈 Revenue Streams

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLATFORM REVENUE SOURCES                      │
└─────────────────────────────────────────────────────────────────┘

1. VERIFICATION FEES (One-time)
   ┌──────────────────────────────────┐
   │ Standard Tier:  GHS 500 per      │
   │ Premium Tier:   GHS 700 per      │
   └──────────────────────────────────┘

2. SESSION COMMISSIONS (Recurring)
   ┌──────────────────────────────────┐
   │ Basic Tier:     20% per session  │
   │ Standard Tier:  15% per session  │
   │ Premium Tier:   15% per session  │
   └──────────────────────────────────┘

Example Monthly Revenue (10 counselors, 100 sessions):
• 4 Basic counselors × 30 sessions × GHS 100 × 20% = GHS 2,400
• 3 Standard counselors × 40 sessions × GHS 100 × 15% = GHS 1,800
• 3 Premium counselors × 30 sessions × GHS 100 × 15% = GHS 1,350
• Verification fees: (3 × GHS 500) + (3 × GHS 700) = GHS 3,600
─────────────────────────────────────────────────────────────────
TOTAL MONTHLY REVENUE: GHS 9,150
```

## 🗄️ Database Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         COUNSELORS TABLE                         │
├─────────────────────────────────────────────────────────────────┤
│ id                              │ INTEGER                        │
│ user_id                         │ INTEGER (FK to users)          │
│ subscription_tier               │ 'basic'/'standard'/'premium'   │
│ commission_rate                 │ 20.00 or 15.00                 │
│ verification_fee_paid           │ TRUE/FALSE                     │
│ verification_payment_reference  │ Paystack reference             │
│ status                          │ 'pending'/'approved'           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   VERIFICATION_PAYMENTS TABLE                    │
├─────────────────────────────────────────────────────────────────┤
│ id                    │ INTEGER                                  │
│ counselor_id          │ INTEGER (FK to counselors)               │
│ amount                │ 500.00 or 700.00                         │
│ tier                  │ 'standard' or 'premium'                  │
│ payment_reference     │ Paystack reference                       │
│ payment_status        │ 'pending'/'success'/'failed'             │
│ paid_at               │ TIMESTAMP                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   PLATFORM_COMMISSIONS TABLE                     │
├─────────────────────────────────────────────────────────────────┤
│ id                    │ INTEGER                                  │
│ session_id            │ INTEGER (FK to sessions)                 │
│ counselor_id          │ INTEGER (FK to counselors)               │
│ session_amount        │ What client paid                         │
│ commission_rate       │ Counselor's rate (20% or 15%)            │
│ commission_amount     │ Platform's cut                           │
│ counselor_earnings    │ What counselor receives                  │
│ status                │ 'pending'/'collected'/'paid'             │
└─────────────────────────────────────────────────────────────────┘
```

## 🎨 UI Elements

### Tier Badges

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│  BASIC:     [ Basic ]                                        │
│                                                               │
│  STANDARD:  [ ✓ Verified Standard ]                         │
│                                                               │
│  PREMIUM:   [ ★ Premium Verified ]                          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Counselor Dashboard - Upgrade Section

```
┌──────────────────────────────────────────────────────────────┐
│  Your Current Tier: BASIC                                     │
│  Commission Rate: 20%                                         │
│                                                               │
│  ┌────────────────────┐  ┌────────────────────┐             │
│  │   UPGRADE TO       │  │   UPGRADE TO       │             │
│  │   STANDARD         │  │   PREMIUM          │             │
│  │                    │  │                    │             │
│  │   GHS 500          │  │   GHS 700          │             │
│  │   One-time fee     │  │   One-time fee     │             │
│  │                    │  │                    │             │
│  │   ✓ Verified badge │  │   ★ Premium badge  │             │
│  │   ✓ 15% commission │  │   ★ 15% commission │             │
│  │   ✓ Priority list  │  │   ★ Top priority   │             │
│  │                    │  │   ★ Featured        │             │
│  │   [Upgrade Now]    │  │   [Upgrade Now]    │             │
│  └────────────────────┘  └────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

## 📊 Sample Data Distribution

```
Current Counselors in Database:

┌─────────────────────────┬──────────┬────────────┬──────────┐
│ Counselor               │ Tier     │ Commission │ Fee Paid │
├─────────────────────────┼──────────┼────────────┼──────────┤
│ Dr. Sarah Owusu         │ Premium  │ 15%        │ ✓ Yes    │
│ Michael Appiah          │ Standard │ 15%        │ ✓ Yes    │
│ Grace Mensah            │ Premium  │ 15%        │ ✓ Yes    │
│ Dr. Emmanuel Boateng    │ Basic    │ 20%        │ ✗ No     │
│ Abena Osei              │ Standard │ 15%        │ ✓ Yes    │
│ Dr. Kwabena Asare       │ Premium  │ 15%        │ ✓ Yes    │
└─────────────────────────┴──────────┴────────────┴──────────┘

Distribution:
• Basic: 1 counselor (16.7%)
• Standard: 2 counselors (33.3%)
• Premium: 3 counselors (50%)
```

## ✅ Implementation Checklist

```
Backend:
☐ Run updated schema.sql
☐ Create upgrade tier endpoint
☐ Integrate Paystack verification
☐ Update commission calculation
☐ Add tier info to counselor API responses

Frontend:
☐ Add tier badges to profiles
☐ Create upgrade page in dashboard
☐ Add Paystack payment integration
☐ Display commission rate in dashboard
☐ Show verification status

Admin:
☐ Add revenue reports by tier
☐ Track verification payments
☐ Monitor commission distribution
☐ View counselor tier statistics
```

---

**🎉 Your platform is now ready for the subscription tier system!**
