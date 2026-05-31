/**
 * DATABASE STATUS CHECKER
 * Quick check to see if database is reachable
 */

require('dotenv').config();
const { Client } = require('pg');

async function checkStatus() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
  
  try {
    await client.connect();
    const result = await client.query('SELECT NOW(), current_database(), version()');
    await client.end();
    
    console.log('✅ DATABASE IS ONLINE');
    console.log(`   Database: ${result.rows[0].current_database}`);
    console.log(`   Time: ${result.rows[0].now}`);
    console.log(`   Version: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
    return true;
  } catch (err) {
    await client.end().catch(() => {});
    console.log('❌ DATABASE IS OFFLINE');
    console.log(`   Reason: ${err.message}`);
    console.log(`\n   Run: node wake-database.js`);
    return false;
  }
}

checkStatus().then(success => process.exit(success ? 0 : 1));
