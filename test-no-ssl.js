/**
 * TEST WITHOUT SSL
 * Testing if SSL is causing the timeout
 */

require('dotenv').config();
const { Client } = require('pg');

async function testWithoutSSL() {
  console.log('\n=== TESTING WITHOUT SSL ===\n');
  
  // Remove SSL parameters from connection string
  const connectionString = process.env.DATABASE_URL.replace(/\?.*$/, '');
  console.log('Connection String (no SSL):', connectionString.replace(/:([^@]+)@/, ':****@'));
  console.log('');
  
  const client = new Client({
    connectionString,
    ssl: false, // Disable SSL
    connectionTimeoutMillis: 30000
  });
  
  try {
    console.log('Attempting connection WITHOUT SSL...');
    await client.connect();
    
    console.log('✅ CONNECTED WITHOUT SSL!\n');
    
    const result = await client.query('SELECT NOW()');
    console.log('✅ Query successful!');
    console.log(`Time: ${result.rows[0].now}`);
    
    await client.end();
    console.log('\n✅ SSL was the problem!\n');
    process.exit(0);
    
  } catch (err) {
    console.log('\n❌ FAILED WITHOUT SSL TOO\n');
    console.log('Error:', err.message);
    console.log('\nThis means the issue is NOT SSL-related.');
    console.log('The database might be:');
    console.log('  1. Deleted or does not exist');
    console.log('  2. Wrong credentials');
    console.log('  3. Network routing issue');
    
    await client.end().catch(() => {});
    process.exit(1);
  }
}

testWithoutSSL();
