# Counselor Subscription Tiers & Commission System

## Overview
Comfort Counsel offers three subscription tiers for counselors, each with different verification fees and commission rates.

## Subscription Tiers

### 1. Basic (Free)
- **Verification Fee**: GHS 0 (Free)
- **Platform Commission**: 20%
- **Counselor Keeps**: 80% of earnings
- **Features**:
  - Basic profile listing
  - Access to all platform features
  - No upfront cost

**Example Calculation:**
- Client pays GHS 100 for session
- Platform takes: GHS 20 (20%)
- Counselor receives: GHS 80 (80%)

### 2. Standard (GHS 500)
- **Verification Fee**: GHS 500 (one-time payment)
- **Platform Commission**: 15%
- **Counselor Keeps**: 85% of earnings
- **Features**:
  - Verified badge
  - Priority listing
  - Lower commission rate
  - All Basic features

**Example Calculation:**
- Client pays GHS 100 for session
- Platform takes: GHS 15 (15%)
- Counselor receives: GHS 85 (85%)

### 3. Premium (GHS 700)
- **Verification Fee**: GHS 700 (one-time payment)
- **Platform Commission**: 15%
- **Counselor Keeps**: 85% of earnings
- **Features**:
  - Premium verified badge
  - Top priority listing
  - Featured counselor status
  - Lower commission rate
  - All Standard features

**Example Calculation:**
- Client pays GHS 100 for session
- Platform takes: GHS 15 (15%)
- Counselor receives: GHS 85 (85%)

## Database Schema

### Counselors Table Fields

```sql
subscription_tier VARCHAR(20) DEFAULT 'basic' 
  -- Values: 'basic', 'standard', 'premium'

commission_rate NUMERIC(5,2) DEFAULT 20.00
  -- Basic: 20.00, Standard: 15.00, Premium: 15.00

verification_fee_paid BOOLEAN DEFAULT FALSE
  -- TRUE if counselor paid verification fee

verification_payment_reference VARCHAR(255)
  -- Payment reference from Paystack
```

### Verification Payments Table

Tracks verification fee payments for Standard and Premium tiers:

```sql
CREATE TABLE verification_payments (
  id SERIAL PRIMARY KEY,
  counselor_id INTEGER REFERENCES counselors(id),
  amount NUMERIC(10,2) NOT NULL,
  tier VARCHAR(20) NOT NULL,
  payment_reference VARCHAR(255) UNIQUE,
  payment_status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Platform Commissions Table

Tracks commission from each session:

```sql
CREATE TABLE platform_commissions (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id),
  counselor_id INTEGER REFERENCES counselors(id),
  session_amount NUMERIC(10,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL,
  counselor_earnings NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## How It Works

### 1. Counselor Registration
```javascript
// New counselor registers
// Default tier: 'basic'
// Default commission_rate: 20.00
// verification_fee_paid: FALSE
```

### 2. Upgrading to Standard/Premium

**Step 1: Counselor selects tier**
```javascript
// Counselor clicks "Upgrade to Standard" or "Upgrade to Premium"
// System shows payment page with amount (GHS 500 or GHS 700)
```

**Step 2: Payment via Paystack**
```javascript
// Initialize Paystack payment
const amount = tier === 'standard' ? 500 : 700;
const reference = generateReference();

// After successful payment:
INSERT INTO verification_payments (
  counselor_id, 
  amount, 
  tier, 
  payment_reference, 
  payment_status, 
  paid_at
) VALUES (
  counselor_id, 
  amount, 
  tier, 
  reference, 
  'success', 
  NOW()
);
```

**Step 3: Update counselor tier**
```javascript
// Update counselor record
UPDATE counselors 
SET 
  subscription_tier = 'standard', -- or 'premium'
  commission_rate = 15.00,
  verification_fee_paid = TRUE,
  verification_payment_reference = reference
WHERE id = counselor_id;
```

### 3. Session Payment & Commission Calculation

**When a client pays for a session:**

```javascript
// Example: Client pays GHS 100 for session
const sessionAmount = 100.00;

// Get counselor's commission rate
const counselor = await getCounselor(counselorId);
const commissionRate = counselor.commission_rate; // 20.00 or 15.00

// Calculate commission
const commissionAmount = sessionAmount * (commissionRate / 100);
const counselorEarnings = sessionAmount - commissionAmount;

// Record commission
INSERT INTO platform_commissions (
  session_id,
  counselor_id,
  session_amount,
  commission_rate,
  commission_amount,
  counselor_earnings,
  status
) VALUES (
  session_id,
  counselor_id,
  100.00,
  commissionRate,
  commissionAmount,  // 20.00 or 15.00
  counselorEarnings, // 80.00 or 85.00
  'pending'
);

// Credit counselor's wallet
UPDATE wallets 
SET balance = balance + counselorEarnings
WHERE user_id = counselor.user_id;
```

## Implementation Examples

### Backend: Get Counselor with Tier Info

```javascript
// In counselorController.js
const getCounselorProfile = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        c.id,
        u.name,
        c.category,
        c.bio,
        c.location,
        c.years_experience,
        c.phone_number,
        c.profile_picture,
        c.subscription_tier,
        c.commission_rate,
        c.verification_fee_paid,
        c.is_available
      FROM counselors c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1 AND c.status = 'approved'
    `, [id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Counselor not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching counselor:', error);
    res.status(500).json({ error: 'Failed to fetch counselor' });
  }
};
```

### Backend: Upgrade Counselor Tier

```javascript
// In counselorController.js
const upgradeTier = async (req, res) => {
  try {
    const { tier, paymentReference } = req.body;
    const counselorId = req.user.counselorId;
    
    // Validate tier
    if (!['standard', 'premium'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }
    
    // Verify payment with Paystack
    const paymentVerified = await verifyPaystackPayment(paymentReference);
    
    if (!paymentVerified) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }
    
    // Get payment amount
    const amount = tier === 'standard' ? 500 : 700;
    
    // Record verification payment
    await pool.query(`
      INSERT INTO verification_payments (
        counselor_id, amount, tier, payment_reference, 
        payment_status, paid_at
      ) VALUES ($1, $2, $3, $4, 'success', NOW())
    `, [counselorId, amount, tier, paymentReference]);
    
    // Update counselor tier
    await pool.query(`
      UPDATE counselors 
      SET 
        subscription_tier = $1,
        commission_rate = 15.00,
        verification_fee_paid = TRUE,
        verification_payment_reference = $2
      WHERE id = $3
    `, [tier, paymentReference, counselorId]);
    
    res.json({ 
      message: 'Tier upgraded successfully',
      tier,
      commission_rate: 15.00
    });
  } catch (error) {
    console.error('Error upgrading tier:', error);
    res.status(500).json({ error: 'Failed to upgrade tier' });
  }
};
```

### Frontend: Display Tier Badge

```javascript
// In counselor profile page
function displayTierBadge(tier) {
  const badges = {
    basic: '<span class="badge badge-basic">Basic</span>',
    standard: '<span class="badge badge-standard">✓ Verified Standard</span>',
    premium: '<span class="badge badge-premium">★ Premium Verified</span>'
  };
  
  return badges[tier] || badges.basic;
}
```

### Frontend: Upgrade Tier Flow

```javascript
// In counselor dashboard
async function upgradeTier(tier) {
  const amount = tier === 'standard' ? 50000 : 70000; // In pesewas
  
  // Initialize Paystack payment
  const handler = PaystackPop.setup({
    key: 'your-paystack-public-key',
    email: counselor.email,
    amount: amount,
    currency: 'GHS',
    ref: generateReference(),
    metadata: {
      custom_fields: [
        {
          display_name: "Tier Upgrade",
          variable_name: "tier",
          value: tier
        }
      ]
    },
    callback: async function(response) {
      // Payment successful
      try {
        await ComfortCounsel.apiRequest('/api/counselors/upgrade-tier', {
          method: 'POST',
          body: JSON.stringify({
            tier: tier,
            paymentReference: response.reference
          })
        });
        
        ComfortCounsel.showToast('Tier upgraded successfully!', 'success');
        location.reload();
      } catch (error) {
        ComfortCounsel.showToast('Upgrade failed: ' + error.message, 'error');
      }
    },
    onClose: function() {
      ComfortCounsel.showToast('Payment cancelled', 'info');
    }
  });
  
  handler.openIframe();
}
```

## Queries for Admin Dashboard

### Total Platform Revenue from Commissions

```sql
SELECT 
  SUM(commission_amount) as total_commission,
  COUNT(*) as total_sessions,
  AVG(commission_amount) as avg_commission
FROM platform_commissions
WHERE status = 'collected';
```

### Revenue by Tier

```sql
SELECT 
  c.subscription_tier,
  COUNT(pc.id) as session_count,
  SUM(pc.commission_amount) as total_commission,
  SUM(pc.counselor_earnings) as total_counselor_earnings
FROM platform_commissions pc
JOIN counselors c ON pc.counselor_id = c.id
GROUP BY c.subscription_tier;
```

### Verification Fee Revenue

```sql
SELECT 
  tier,
  COUNT(*) as payment_count,
  SUM(amount) as total_revenue
FROM verification_payments
WHERE payment_status = 'success'
GROUP BY tier;
```

### Counselor Earnings by Tier

```sql
SELECT 
  c.subscription_tier,
  u.name,
  COUNT(pc.id) as sessions_completed,
  SUM(pc.counselor_earnings) as total_earnings,
  c.commission_rate
FROM counselors c
JOIN users u ON c.user_id = u.id
LEFT JOIN platform_commissions pc ON c.id = pc.counselor_id
GROUP BY c.id, u.name, c.subscription_tier, c.commission_rate
ORDER BY total_earnings DESC;
```

## Sample Data in Schema

The updated schema includes 6 counselors with different tiers:

1. **Dr. Sarah Owusu** - Premium (15% commission)
2. **Michael Appiah** - Standard (15% commission)
3. **Grace Mensah** - Premium (15% commission)
4. **Dr. Emmanuel Boateng** - Basic (20% commission)
5. **Abena Osei** - Standard (15% commission)
6. **Dr. Kwabena Asare** - Premium (15% commission)

## Next Steps

1. **Run the updated schema.sql** to create tables with tier support
2. **Implement tier upgrade endpoint** in counselorController.js
3. **Add tier badges** to counselor profile pages
4. **Create upgrade UI** in counselor dashboard
5. **Implement commission calculation** in payment flow
6. **Add admin reports** for revenue tracking

---

**Questions?** The system is now ready to handle different subscription tiers and automatically calculate the correct commission based on each counselor's tier!
