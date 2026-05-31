/**
 * FINAL CONNECTION TEST
 * Testing with exact credentials and detailed error logging
 */

require('dotenv').config();
const { Client } = require('pg');

async function testConnection() {
  console.log('\n=== FINAL CONNECTION TEST ===\n');
  
  const connectionString = process.env.DATABASE_URL;
  console.log('Connection String:', connectionString.replace(/:([^@]+)@/, ':****@'));
  console.log('');
  
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 60000 // 60 seconds
  });
  
  try {
    console.log('Attempting connection...');
    const startTime = Date.now();
    
    await client.connect();
    
    const connectTime = Date.now() - startTime;
    console.log(`✅ CONNECTED in ${connectTime}ms\n`);
    
    const result = await client.query('SELECT NOW(), current_database(), version()');
    console.log('✅ Query successful!');
    console.log(`Database: ${result.rows[0].current_database}`);
    console.log(`Time: ${result.rows[0].now}`);
    console.log(`Version: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
    
    await client.end();
    console.log('\n✅ SUCCESS! Database is working!\n');
    process.exit(0);
    
  } catch (err) {
    console.log('\n❌ CONNECTION FAILED\n');
    console.log('Error Name:', err.name);
    console.log('Error Code:', err.code || 'N/A');
    console.log('Error Message:', err.message);
    console.log('\nFull Error:');
    console.error(err);
    
    await client.end().catch(() => {});
    process.exit(1);
  }
}

testConnection();
