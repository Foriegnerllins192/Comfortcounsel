// CRITICAL: Force IPv4 DNS resolution FIRST (must be before any imports)
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// Set DNS to use system resolver (more reliable on Windows)
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const { Pool } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ANSI color codes for console logging
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Helper function for colored console logs
const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${colors.bright}${msg}${colors.reset}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset} ${colors.red}${msg}${colors.reset}`),
  warn: (msg) => console.warn(`${colors.yellow}⚠${colors.reset} ${colors.yellow}${msg}${colors.reset}`),
  debug: (msg) => console.log(`${colors.magenta}→${colors.reset} ${msg}`)
};

// Validate DATABASE_URL
if (!process.env.DATABASE_URL) {
  log.error('DATABASE_URL is not defined in environment variables!');
  log.warn('Check that .env file exists and contains DATABASE_URL');
  process.exit(1);
}

// Log masked DATABASE_URL
const maskedUrl = process.env.DATABASE_URL.replace(/:([^@]+)@/, ':****@');
log.debug(`DATABASE_URL loaded: ${maskedUrl}`);

// Configure connection pool with Neon-optimized settings
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  
  // SSL Configuration (REQUIRED for Neon)
  ssl: {
    rejectUnauthorized: false
  },
  
  // Connection pool limits
  max: 10,
  min: 0,
  
  // Timeout settings (optimized for stability)
  connectionTimeoutMillis: 20000,  // 20 seconds
  idleTimeoutMillis: 30000,
  query_timeout: 15000,
  
  // Keep-alive for stable connections
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  // Application name for debugging
  application_name: 'comfort-counsel-app'
};

log.debug('Creating connection pool with IPv4-first DNS');
log.debug(`Pool config: max=${poolConfig.max}, timeout=${poolConfig.connectionTimeoutMillis}ms`);

const pool = new Pool(poolConfig);

// Pool error handler
pool.on('error', (err) => {
  log.error(`Unexpected pool error: ${err.message}`);
  if (err.message && err.message.includes('timeout')) {
    log.warn('Connection timeout - database may be sleeping or network issue');
  }
});

pool.on('connect', () => {
  log.debug('New connection established');
});

pool.on('remove', () => {
  log.debug('Connection removed from pool');
});

/**
 * Attempt to connect with retry logic
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} retryDelay - Delay between retries in ms
 * @returns {Promise<Object|null>} - Returns client or null
 */
async function connectWithRetry(maxRetries = 3, retryDelay = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log.info(`Connection attempt ${attempt}/${maxRetries}...`);
      const startTime = Date.now();
      
      const client = await pool.connect();
      const connectTime = Date.now() - startTime;
      
      log.success(`Connected in ${connectTime}ms`);
      
      // Test connection with SELECT NOW()
      const testStart = Date.now();
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version, inet_server_addr() as server_ip');
      const queryTime = Date.now() - testStart;
      
      const time = result.rows[0].current_time;
      const version = result.rows[0].pg_version.split(' ').slice(0, 2).join(' ');
      const serverIp = result.rows[0].server_ip;
      
      log.success(`Database: ${version}`);
      log.info(`Server IP: ${serverIp} (${serverIp.includes(':') ? 'IPv6' : 'IPv4'})`);
      log.info(`Server time: ${new Date(time).toLocaleString()}`);
      log.debug(`Query time: ${queryTime}ms`);
      
      return client;
      
    } catch (err) {
      log.error(`Attempt ${attempt} failed`);
      log.error(`Error: ${err.message}`);
      log.error(`Code: ${err.code || 'N/A'}`);
      
      // Specific error detection
      if (err.code === 'ENOTFOUND') {
        log.warn('🔍 DNS RESOLUTION FAILED');
        log.warn('Node.js cannot resolve the database hostname');
        console.log('  Solutions:');
        console.log('  1. Check internet connection');
        console.log('  2. Try mobile hotspot');
        console.log('  3. Flush DNS: ipconfig /flushdns');
        console.log('  4. Restart computer');
      } else if (err.message.includes('timeout') || err.code === 'ETIMEDOUT') {
        log.warn('⏱️  CONNECTION TIMEOUT');
        log.warn('Database not responding (may be sleeping or network blocking)');
        console.log('  Solutions:');
        console.log('  1. Wake database: https://console.neon.tech/');
        console.log('  2. Try mobile hotspot');
        console.log('  3. Check firewall settings');
      } else if (err.code === 'ECONNREFUSED') {
        log.warn('🚫 CONNECTION REFUSED');
        console.log('  Solutions:');
        console.log('  1. Database may be sleeping - wake at console.neon.tech');
        console.log('  2. Verify DATABASE_URL is correct');
      }
      
      if (attempt < maxRetries) {
        log.warn(`Retrying in ${retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        log.error('❌ All connection attempts failed');
        console.log('');
        log.warn('TROUBLESHOOTING:');
        console.log('  • Try mobile hotspot (bypasses ISP/DNS issues)');
        console.log('  • Flush DNS cache: ipconfig /flushdns');
        console.log('  • Restart your computer');
        console.log('  • Check database: https://console.neon.tech/');
        console.log('');
        return null;
      }
    }
  }
  return null;
}

/**
 * Initialize database tables and run migrations
 */
const initDB = async () => {
  log.info('🚀 Starting database initialization...');
  
  let client = null;
  
  try {
    // Connect with retry logic
    client = await connectWithRetry(3, 3000);
    
    if (!client) {
      throw new Error('Failed to acquire database client after retries');
    }
    
    log.success('✅ Client acquired');
    log.info('Creating tables...');
    
    // Create tables (idempotent)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'counselor', 'admin')),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS counselors (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL,
        bio TEXT,
        phone_number VARCHAR(20) NOT NULL,
        location VARCHAR(255),
        years_experience INTEGER DEFAULT 0,
        profile_picture TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        counselor_id INTEGER REFERENCES counselors(id) ON DELETE SET NULL,
        caller_phone VARCHAR(20),
        counselor_phone VARCHAR(20),
        payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
        session_status VARCHAR(20) DEFAULT 'scheduled' CHECK (session_status IN ('scheduled', 'active', 'completed', 'cancelled')),
        expires_at TIMESTAMP,
        call_started_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS counselor_payouts (
        id SERIAL PRIMARY KEY,
        counselor_id INTEGER REFERENCES counselors(id) ON DELETE CASCADE,
        amount NUMERIC(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
        note TEXT,
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS wallets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        balance NUMERIC(10,2) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        amount NUMERIC(10,2) NOT NULL,
        type VARCHAR(20) CHECK (type IN ('credit', 'debit')),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
        amount NUMERIC(10,2) NOT NULL,
        paystack_reference VARCHAR(255) UNIQUE,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        reset_token VARCHAR(64) NOT NULL UNIQUE,
        reset_token_expiry TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    log.success('Tables created');
    log.info('Running migrations...');
    
    // Run migrations (idempotent)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='counselors' AND column_name='is_available') THEN
          ALTER TABLE counselors ADD COLUMN is_available BOOLEAN DEFAULT TRUE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='caller_phone') THEN
          ALTER TABLE sessions ADD COLUMN caller_phone VARCHAR(20);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='counselor_phone') THEN
          ALTER TABLE sessions ADD COLUMN counselor_phone VARCHAR(20);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='expires_at') THEN
          ALTER TABLE sessions ADD COLUMN expires_at TIMESTAMP;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='call_started_at') THEN
          ALTER TABLE sessions ADD COLUMN call_started_at TIMESTAMP;
        END IF;
      END $$;
    `);
    
    log.success('Migrations completed');
    log.success('✅ Database initialization complete!');
    log.success('🎉 All systems ready');
    
    return true;
    
  } catch (err) {
    log.error('❌ Database initialization failed!');
    log.error(`Error: ${err.message}`);
    log.error(`Code: ${err.code || 'N/A'}`);
    
    // Error-specific guidance
    if (err.code === 'ENOTFOUND') {
      console.log('');
      log.error('🔍 DNS RESOLUTION FAILURE');
      console.log('  This is a Windows DNS issue. Try:');
      console.log('  1. ipconfig /flushdns');
      console.log('  2. Restart computer');
      console.log('  3. Use mobile hotspot');
      console.log('  4. Change DNS to 8.8.8.8');
    } else if (err.message.includes('timeout')) {
      console.log('');
      log.error('🔍 CONNECTION TIMEOUT');
      console.log('  Database not responding. Try:');
      console.log('  1. Wake database: https://console.neon.tech/');
      console.log('  2. Use mobile hotspot');
      console.log('  3. Check firewall');
    }
    
    console.log('');
    log.warn('⚠️  Server will continue in LIMITED MODE');
    console.log('');
    
    return false;
    
  } finally {
    if (client) {
      client.release();
      log.debug('Client released');
    }
  }
};

/**
 * Gracefully close all database connections
 */
async function closePool() {
  try {
    await pool.end();
    log.success('Database pool closed');
  } catch (err) {
    log.error(`Error closing pool: ${err.message}`);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  log.info('Received SIGINT, closing connections...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log.info('Received SIGTERM, closing connections...');
  await closePool();
  process.exit(0);
});

module.exports = { pool, initDB, closePool };
