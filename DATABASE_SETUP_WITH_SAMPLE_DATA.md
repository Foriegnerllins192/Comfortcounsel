# Database Setup with Sample Data

## Overview
This guide will help you set up your Comfort Counsel database with sample counselors and users so everything loads from the database.

## What's Included

### Sample Users (Clients)
- **John Mensah** - john.mensah@example.com
- **Akua Asante** - akua.asante@example.com
- **Kwame Osei** - kwame.osei@example.com
- **Ama Boateng** - ama.boateng@example.com
- **Kofi Adjei** - kofi.adjei@example.com

### Sample Counselors (All Approved & Available)
1. **Dr. Sarah Owusu** - Relationship Counselor (12 years experience)
   - Email: sarah.owusu@comfortcounsel.com
   - Location: Accra, Ghana
   - Phone: 0201234567

2. **Michael Appiah** - Family Therapist (8 years experience)
   - Email: michael.appiah@comfortcounsel.com
   - Location: Kumasi, Ghana
   - Phone: 0202345678

3. **Grace Mensah** - Career Development Specialist (10 years experience)
   - Email: grace.mensah@comfortcounsel.com
   - Location: Accra, Ghana
   - Phone: 0203456789

4. **Dr. Emmanuel Boateng** - Youth Counselor (15 years experience)
   - Email: emmanuel.boateng@comfortcounsel.com
   - Location: Takoradi, Ghana
   - Phone: 0204567890

5. **Abena Osei** - Business Psychology Consultant (7 years experience)
   - Email: abena.osei@comfortcounsel.com
   - Location: Accra, Ghana
   - Phone: 0205678901

6. **Dr. Kwabena Asare** - Mental Wellness Specialist (20 years experience)
   - Email: kwabena.asare@comfortcounsel.com
   - Location: Kumasi, Ghana
   - Phone: 0206789012

### Admin User
- **Email**: admin@comfortcounsel.com
- **Password**: password123

**All sample users have the same password: `password123`**

## Setup Instructions

### Option 1: Using Neon SQL Editor (Recommended)

1. Go to your Neon dashboard: https://console.neon.tech
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Copy the entire contents of `schema.sql`
5. Paste it into the SQL Editor
6. Click "Run" to execute
7. Wait for completion (should take a few seconds)

### Option 2: Using psql Command Line

```bash
# Navigate to the comfort-counsel directory
cd comfort-counsel

# Run the schema file
psql "postgresql://your-connection-string" -f schema.sql
```

Replace `your-connection-string` with your actual Neon database connection string from `.env`

### Option 3: Using Node.js Script

Create a file called `setup-database.js`:

```javascript
const { pool } = require('./server/database');
const fs = require('fs');

async function setupDatabase() {
  try {
    const schema = fs.readFileSync('./schema.sql', 'utf8');
    await pool.query(schema);
    console.log('✅ Database setup complete!');
    console.log('✅ 6 counselors added');
    console.log('✅ 5 client users added');
    console.log('✅ 1 admin user added');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();
```

Then run:
```bash
node setup-database.js
```

## Verification

After running the schema, verify the data was inserted:

```sql
-- Check users
SELECT id, name, email, role FROM users;

-- Check counselors
SELECT c.id, u.name, c.category, c.years_experience, c.status 
FROM counselors c 
JOIN users u ON c.user_id = u.id;

-- Check approved counselors (these will show on homepage)
SELECT c.id, u.name, c.category, c.location, c.years_experience 
FROM counselors c 
JOIN users u ON c.user_id = u.id 
WHERE c.status = 'approved';
```

## Testing Login

You can now log in with any of these accounts:

### As a Client:
- Email: `john.mensah@example.com`
- Password: `password123`

### As a Counselor:
- Email: `sarah.owusu@comfortcounsel.com`
- Password: `password123`

### As Admin:
- Email: `admin@comfortcounsel.com`
- Password: `password123`

## What Will Work After Setup

✅ **Homepage** - Will display 6 real counselors from database
✅ **Find Counselors Page** - Will show all 6 approved counselors
✅ **Counselor Profile Pages** - Will load real data from database
✅ **User Account Page** - Will show your real profile data
✅ **Counselor Dashboard** - Will show counselor's real profile
✅ **Profile Editing** - Counselors can update their profiles
✅ **Login/Registration** - Fully functional with database

## Troubleshooting

### Error: "relation already exists"
This means tables already exist. The schema includes `DROP TABLE IF EXISTS` commands, so this shouldn't happen. If it does, manually drop all tables first:

```sql
DROP TABLE IF EXISTS counselor_payouts CASCADE;
DROP TABLE IF EXISTS wallet_transactions CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS password_resets CASCADE;
DROP TABLE IF EXISTS counselors CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

### Error: "connection refused"
Check your `.env` file and make sure `DATABASE_URL` is correct.

### Counselors not showing on homepage
1. Check that counselors have `status = 'approved'`
2. Check that the API endpoint `/api/counselors` is working
3. Check browser console for JavaScript errors

## Next Steps

After setting up the database:

1. **Start the server**: `npm start`
2. **Visit homepage**: http://localhost:3000
3. **You should see 6 counselors** loaded from the database
4. **Click on any counselor** to see their full profile
5. **Login as a client** to test the account page
6. **Login as a counselor** to test the dashboard and profile editing

## Adding More Counselors

To add more counselors, you can:

1. **Register as a new counselor** through the registration page
2. **Approve them as admin** through the admin dashboard
3. **Or insert directly via SQL**:

```sql
-- First create a user
INSERT INTO users (name, email, password, role) VALUES
('New Counselor', 'new@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'counselor');

-- Then create their counselor profile (use the user_id from above)
INSERT INTO counselors (user_id, category, bio, phone_number, location, years_experience, status) VALUES
(13, 'Relationship', 'Bio here...', '0201234567', 'Accra', 5, 'approved');
```

## Important Notes

- All sample passwords are `password123` (hashed with bcrypt)
- All counselors are pre-approved and available
- All users have wallets created automatically
- The database includes proper indexes for performance
- Foreign keys ensure data integrity

---

**Need help?** Check the console logs or contact support.
