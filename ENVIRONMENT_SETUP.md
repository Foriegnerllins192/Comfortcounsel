# Comfort Counsel - Environment Configuration Guide

## Required Environment Variables

Create a `.env` file in the root directory of the project with the following variables:

### Server Configuration
```env
PORT=3000
APP_URL=https://your-backend-name.onrender.com
```
- `PORT`: The port number for the Express server (default: 3000)
- `APP_URL`: The public URL of your deployed application (used in emails)

### Database Configuration
```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```
- `DATABASE_URL`: PostgreSQL connection string for Supabase or any PostgreSQL database
- Format: `postgresql://[user]:[password]@[host]/[database]?sslmode=require`
- Example: `postgresql://postgres:mypassword@db.supabase.co:5432/postgres?sslmode=require`

### Authentication
```env
JWT_SECRET=your_jwt_secret_here
```
- `JWT_SECRET`: Secret key for signing JWT tokens (use a strong random string)
- Generate a secure secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Payment Gateway (Paystack/Hubtel)
```env
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public
```
- `PAYSTACK_SECRET_KEY`: Your Paystack secret key (get from Paystack dashboard)
- `PAYSTACK_PUBLIC_KEY`: Your Paystack public key (get from Paystack dashboard)
- Note: The codebase currently uses Paystack. To migrate to Hubtel, update the payment integration in `bookingController.js`

### Hubtel Voice API (for call bridging)
```env
HUBTEL_CLIENT_ID=your_hubtel_client_id
HUBTEL_CLIENT_SECRET=your_hubtel_client_secret
HUBTEL_FROM=0203045678
HOTLINE_NUMBER=0203045678
HUBTEL_VOICE_API=https://api.hubtel.com/v1/calls
```
- `HUBTEL_CLIENT_ID`: Your Hubtel API client ID
- `HUBTEL_CLIENT_SECRET`: Your Hubtel API client secret
- `HUBTEL_FROM`: The phone number calls will originate from
- `HOTLINE_NUMBER`: The hotline number displayed to users
- `HUBTEL_VOICE_API`: Hubtel Voice API endpoint (default: https://api.hubtel.com/v1/calls)

### Email Service (Nodemailer with Gmail)
```env
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
```
- `EMAIL_USER`: Your Gmail address
- `EMAIL_PASS`: Gmail App Password (NOT your regular Gmail password)

#### How to Generate Gmail App Password:
1. Go to your Google Account settings
2. Navigate to Security → 2-Step Verification (enable if not already)
3. Scroll down to "App passwords"
4. Select "Mail" and "Other (Custom name)"
5. Generate and copy the 16-character password
6. Use this password in the `EMAIL_PASS` variable

### Admin Account (for seeding)
```env
ADMIN_EMAIL=admin@comfortcounsel.com
ADMIN_PASSWORD=admin123
```
- `ADMIN_EMAIL`: Default admin email for initial setup
- `ADMIN_PASSWORD`: Default admin password (change after first login)

## Setup Instructions

### 1. Install Dependencies
```bash
cd comfort-counsel
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

### 3. Set Up Database
The database schema is automatically initialized when the server starts. The following tables will be created:
- `users` - User accounts (clients, counselors, admins)
- `counselors` - Counselor profiles
- `sessions` - Counseling sessions
- `payments` - Payment records
- `wallets` - User wallet balances
- `wallet_transactions` - Transaction history
- `counselor_payouts` - Payout records
- `password_resets` - Password reset tokens

### 4. Create Admin Account (Optional)
Run the seed script to create an initial admin account:
```bash
node server/seedAdmin.js
```

### 5. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in `.env`)

## Deployment

### Deploying to Render

1. **Create a new Web Service** on Render
2. **Connect your GitHub repository**
3. **Configure Build & Start Commands:**
   - Build Command: `npm install`
   - Start Command: `npm start`
4. **Add Environment Variables:**
   - Go to Environment tab
   - Add all variables from your `.env` file
5. **Deploy**

### Deploying to Heroku

1. **Create a new Heroku app:**
   ```bash
   heroku create your-app-name
   ```

2. **Add PostgreSQL addon:**
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   ```

3. **Set environment variables:**
   ```bash
   heroku config:set JWT_SECRET=your_secret
   heroku config:set PAYSTACK_SECRET_KEY=your_key
   # ... add all other variables
   ```

4. **Deploy:**
   ```bash
   git push heroku main
   ```

## Supabase Setup

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the database to be provisioned

### 2. Get Database Connection String
1. Go to Project Settings → Database
2. Copy the "Connection string" under "Connection pooling"
3. Replace `[YOUR-PASSWORD]` with your database password
4. Use this as your `DATABASE_URL`

### 3. Database Schema
The schema is automatically created when the server starts. No manual SQL execution is required.

## Troubleshooting

### Database Connection Issues
- Ensure `DATABASE_URL` is correct and includes `?sslmode=require`
- Check that your IP is whitelisted in Supabase (or disable IP restrictions)
- Verify database credentials are correct

### Email Not Sending
- Ensure you're using a Gmail App Password, not your regular password
- Check that 2-Step Verification is enabled on your Google account
- Verify `EMAIL_USER` and `EMAIL_PASS` are correct

### Payment Integration Issues
- Verify Paystack API keys are correct (test vs live keys)
- Check that webhook URLs are configured in Paystack dashboard
- Ensure `APP_URL` is set to your deployed backend URL

### Hubtel Voice API Issues
- Verify Hubtel credentials are correct
- Check that `HOTLINE_NUMBER` is a valid phone number
- Review Hubtel API documentation for call bridging setup

## Security Best Practices

1. **Never commit `.env` file to version control**
2. **Use strong, random values for `JWT_SECRET`**
3. **Change default admin password after first login**
4. **Use environment-specific API keys** (test keys for development, live keys for production)
5. **Enable SSL/HTTPS in production**
6. **Regularly rotate API keys and secrets**
7. **Use Supabase Row Level Security (RLS)** for additional database protection

## Support

For issues or questions:
- Email: hello@comfortcounsel.com
- Documentation: See README.md for additional information
