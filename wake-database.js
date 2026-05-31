/**
 * DATABASE WAKE-UP SCRIPT
 * 
 * This script attempts to wake a sleeping Neon database by:
 * 1. Making multiple connection attempts with longer timeouts
 * 2. Retrying if the first attempt times out
 * 3. Providing clear feedback on what's happening
 */

require('dotenv').config();
const { Client } = require('pg');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

async function wakeDatabase(attempt = 1, maxAttempts = 3) {
  console.log(`${colors.cyan}Attempt ${attempt}/${maxAttempts}: Connecting to database...${colors.reset}`);
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 30000 // 30 seconds - longer for wake-up
  });
  
  try {
    const startTime = Date.now();
    await client.connect();
    const connectTime = Date.now() - startTime;
    
    console.log(`${colors.green}✓ Connected in ${connectTime}ms${colors.reset}`);
    
    // Run a simple query
    const result = await client.query('SELECT NOW() as time, current_database() as db');
    console.log(`${colors.green}✓ Database is awake: ${result.rows[0].db}${colors.reset}`);
    console.log(`${colors.green}✓ Server time: ${result.rows[0].time}${colors.reset}`);
    
    await client.end();
    
    console.log(`\n${colors.green}SUCCESS! Database is now awake and ready.${colors.reset}`);
    console.log(`\nYou can now start your server:`);
    console.log(`  cd comfort-counsel`);
    console.log(`  node server/server.js`);
    
    return true;
    
  } catch (err) {
    await client.end().catch(() => {});
    
    if (err.message.includes('timeout')) {
      console.log(`${colors.yellow}⚠ Connection timeout (database may be sleeping)${colors.reset}`);
      
      if (attempt < maxAttempts) {
        console.log(`${colors.yellow}Waiting 5 seconds before retry...${colors.reset}\n`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return wakeDatabase(attempt + 1, maxAttempts);
      } else {
        console.log(`\n${colors.red}✗ Failed to wake database after ${maxAttempts} attempts${colors.reset}`);
        console.log(`\n${colors.yellow}Manual steps required:${colors.reset}`);
        console.log(`1. Go to https://console.neon.tech/`);
        console.log(`2. Log in to your account`);
        console.log(`3. Click on your database: ep-crimson-scene-agu4en7g`);
        console.log(`4. Wait for it to show as "Active"`);
        console.log(`5. Run this script again: node wake-database.js`);
        console.log(`\n${colors.yellow}OR check if:${colors.reset}`);
        console.log(`• Database was deleted (create new one)`);
        console.log(`• Credentials changed (update .env file)`);
        console.log(`• You're on a network that blocks PostgreSQL (try mobile hotspot)`);
        return false;
      }
    } else if (err.code === 'ENOTFOUND') {
      console.log(`${colors.red}✗ DNS resolution failed${colors.reset}`);
      console.log(`${colors.yellow}Check your internet connection${colors.reset}`);
      return false;
    } else if (err.message.includes('password') || err.message.includes('authentication')) {
      console.log(`${colors.red}✗ Authentication failed${colors.reset}`);
      console.log(`${colors.yellow}Check your DATABASE_URL credentials in .env file${colors.reset}`);
      return false;
    } else {
      console.log(`${colors.red}✗ Connection failed: ${err.message}${colors.reset}`);
      console.log(`${colors.yellow}Error code: ${err.code || 'N/A'}${colors.reset}`);
      return false;
    }
  }
}

console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.cyan}  DATABASE WAKE-UP SCRIPT${colors.reset}`);
console.log(`${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);

wakeDatabase()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error(`${colors.red}Unexpected error:${colors.reset}`, err);
    process.exit(1);
  });
