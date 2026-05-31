# 🗄️ Database Setup Guide - Production Ready

## ✅ What's Been Fixed

Your database connection has been completely hardened with:

1. **Retry Logic** - 3 automatic retry attempts with 2-second delays
2. **Connection Pooling** - Optimized for Neon serverless
3. **SSL Configuration** - Properly configured for Neon
4. **Timeout Settings** - Prevents hanging connections
5. **Colored Logging** - Clear, visual feedback
6. **Graceful Degradation** - Server continues even if DB fails
7. **Connection Testing** - Validates connection with `SELECT NOW()`
8. **Error Handling** - Detailed, helpful error messages

## 📁 Files Updated

### 1. `server/database.js` (Complete Rewrite)

**New Features:**
- ✅ Retry logic (3 attempts, 2s delay)
- ✅ Connection pooling (min: 2, max: 20)
- ✅ SSL with `rejectUnauthorized: false`
- ✅ Timeouts: connection (10s), idle (30s), query (30s)
- ✅ Colored console logs (cyan, green, red, yellow)
- ✅ Connection test with `SELECT NOW()` and `version()`
- ✅ Graceful shutdown handlers (SIGINT, SIGTERM)
- ✅ Pool event handlers (error, connect, remove)
- ✅ Helpful troubleshooting tips on failure

### 2. `.env.example` (New File)

Template for environment variables with comments.

## 🚀 Integration with server.js

### Current Integration (Already Working)

Your `server.js` already has the correct integration:

```javascript
const { initDB } = require('./database');

// Start server immediately, initialize DB in background
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  
  // Initialize database in background (non-blocking)
  initDB()
    .then(() => {
      console.log('✅ Database ready');
      isDatabaseConnected = true;
    })
    .catch(err => {
      console.error('⚠️  Database initialization failed');
      isDatabaseConnected = false;
    });
});
```

### Alternative: Wait for Database (Optional)

If you want to wait for the database before starting the server:

```javascript
const { initDB } = require('./database');

// Initialize database first, then start server
initDB()
  .then((success) => {
    if (success) {
      app.listen(PORT, () => {
        console.log(`✅ Server running on http://localhost:${PORT}`);
      });
    } else {
      console.error('⚠️  Starting server without database');
      app.listen(PORT, () => {
        console.log(`⚠️  Server running on http://localhost:${PORT} (DB unavailable)`);
      });
    }
  });
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

**Required Variables:**
```env
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require
PORT=3000
JWT_SECRET=your_secret_key
```

### Database URL Format

For Neon, use this format:

```
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

**Example:**
```
postgresql://neondb_owner:abc123@ep-cool-name-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## 🎨 Console Output Examples

### Successful Connection

```
ℹ Starting database initialization...
ℹ Connection attempt 1/3...
→ New database connection established
✓ Database connected: PostgreSQL 15.3
ℹ Server time: 1/15/2024, 10:30:45 AM
ℹ Creating tables...
✓ Tables created successfully
ℹ Running migrations...
✓ Migrations completed successfully
✓ Database initialization complete!
→ Database client released
```

### Failed Connection (with Retry)

```
ℹ Starting database initialization...
ℹ Connection attempt 1/3...
✗ Attempt 1 failed: Connection terminated due to connection timeout
⚠ Retrying in 2 seconds...
ℹ Connection attempt 2/3...
✗ Attempt 2 failed: Connection terminated due to connection timeout
⚠ Retrying in 2 seconds...
ℹ Connection attempt 3/3...
✗ Attempt 3 failed: Connection terminated due to connection timeout
✗ All connection attempts failed
✗ Database initialization failed!
✗ Error: Failed to establish database connection after retries

⚠ Troubleshooting tips:
  1. Check if your Neon database is awake (serverless databases sleep when inactive)
     → Visit: https://console.neon.tech/
  2. Verify your DATABASE_URL in .env file
  3. Check your internet connection
  4. Ensure SSL is enabled in your connection string
```

## 🔍 Testing the Connection

### Method 1: Start the Server

```bash
cd comfort-counsel
npm start
```

Watch the colored console output for connection status.

### Method 2: Test Script

Create `test-db-connection.js`:

```javascript
require('dotenv').config();
const { initDB, closePool } = require('./server/database');

async function test() {
  console.log('Testing database connection...\n');
  
  const success = await initDB();
  
  if (success) {
    console.log('\n✅ Database connection test PASSED');
  } else {
    console.log('\n❌ Database connection test FAILED');
  }
  
  await closePool();
  process.exit(success ? 0 : 1);
}

test();
```

Run it:
```bash
node test-db-connection.js
```

## 🛠️ Troubleshooting

### Issue: "Connection terminated due to connection timeout"

**Causes:**
1. Neon database is sleeping (most common)
2. Wrong DATABASE_URL
3. Network/firewall blocking connection
4. SSL misconfiguration

**Solutions:**

#### 1. Wake Up Neon Database
1. Go to https://console.neon.tech/
2. Log in
3. Find your project
4. Click on the database (this wakes it up)
5. Wait 10-20 seconds
6. Restart your server

#### 2. Verify DATABASE_URL
```bash
# Check if DATABASE_URL is set
echo $env:DATABASE_URL  # PowerShell
echo %DATABASE_URL%     # CMD
```

Should look like:
```
postgresql://user:pass@host.neon.tech/db?sslmode=require
```

#### 3. Check Network
```bash
# Test if you can reach Neon
ping your-host.neon.tech
```

#### 4. Verify SSL Mode
Make sure your DATABASE_URL ends with `?sslmode=require`

### Issue: "DATABASE_URL is not defined"

**Solution:**
1. Create `.env` file in project root
2. Add: `DATABASE_URL=your_connection_string`
3. Restart server

### Issue: Pool errors after long idle

**Solution:**
The new configuration handles this automatically with:
- `idleTimeoutMillis: 30000` - Closes idle connections
- `keepAlive: true` - Keeps connections alive
- Automatic reconnection on pool errors

## 📊 Connection Pool Settings

```javascript
{
  max: 20,                    // Maximum connections
  min: 2,                     // Minimum connections
  connectionTimeoutMillis: 10000,  // 10s to connect
  idleTimeoutMillis: 30000,        // 30s idle timeout
  query_timeout: 30000,            // 30s query timeout
  keepAlive: true,                 // Keep connections alive
  keepAliveInitialDelayMillis: 10000
}
```

**Why these settings?**
- **max: 20** - Neon free tier supports up to 20 connections
- **min: 2** - Keeps 2 connections warm for faster queries
- **10s timeout** - Enough time for Neon to wake up
- **30s idle** - Closes unused connections to save resources
- **keepAlive** - Prevents connection drops in serverless

## 🔐 Security Best Practices

### 1. Never Commit .env
```bash
# Add to .gitignore
.env
.env.local
.env.*.local
```

### 2. Use Strong JWT Secret
```bash
# Generate a random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Rotate Database Credentials
- Change passwords regularly
- Use Neon's credential rotation feature
- Update .env after rotation

### 4. Use Environment-Specific URLs
```env
# Development
DATABASE_URL=postgresql://dev_user:pass@dev-host.neon.tech/dev_db

# Production
DATABASE_URL=postgresql://prod_user:pass@prod-host.neon.tech/prod_db
```

## 📈 Monitoring

### Check Pool Status

Add this endpoint to your server:

```javascript
app.get('/api/health/db', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: result.rows[0].now
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message
    });
  }
});
```

Test it:
```bash
curl http://localhost:3000/api/health/db
```

## 🚀 Production Deployment

### Render.com

1. Add environment variable in Render dashboard:
   ```
   DATABASE_URL=your_neon_connection_string
   ```

2. Render will automatically use it

### Vercel

1. Add to Vercel environment variables
2. Redeploy

### Railway

1. Add to Railway variables
2. Automatic deployment

## 📝 Summary

✅ **What's Working:**
- Automatic retry on connection failure
- Colored, helpful console logs
- Connection pooling optimized for Neon
- Graceful degradation (server runs without DB)
- SSL properly configured
- Timeout protection

✅ **What to Do:**
1. Copy `.env.example` to `.env`
2. Add your Neon DATABASE_URL
3. Wake up your Neon database
4. Run `npm start`
5. Watch the colored logs

✅ **Expected Behavior:**
- Server starts immediately
- Database connects in background
- If DB fails, server continues running
- Helpful error messages guide you to fix

---

**Need Help?**
- Check Neon dashboard: https://console.neon.tech/
- Verify .env file exists and has DATABASE_URL
- Look for colored error messages in console
- Follow troubleshooting tips in the output
