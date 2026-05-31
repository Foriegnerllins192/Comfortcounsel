/**
 * SIMPLE CONNECTION TEST
 * Tests if the database is actually reachable
 */

require('dotenv').config();
const { Client } = require('pg');

async function testConnection() {
  console.log('Testing database connection...\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 20000 // 20 seconds
  });
  
  try {
    console.log('Connecting...');
    await client.connect();
    console.log('✓ Connected successfully!\n');
    
    console.log('Running test query...');
    const result = await client.query('SELECT NOW() as time, version() as version, current_database() as db');
    
    console.log('✓ Query successful!\n');
    console.log('Database:', result.rows[0].db);
    console.log('Time:', result.rows[0].time);
    console.log('Version:', result.rows[0].version.split(' ').slice(0, 2).join(' '));
    
    await client.end();
    console.log('\n✓ Connection test PASSED');
    process.exit(0);
    
  } catch (err) {
    console.error('✗ Connection test FAILED\n');
    console.error('Error:', err.message);
    console.error('Code:', err.code || 'N/A');
    
    if (err.message.includes('timeout')) {
      console.log('\nThis is a timeout error. Possible causes:');
      console.log('1. Database is sleeping (Neon free tier) - wake it at https://console.neon.tech/');
      console.log('2. Wrong credentials');
      console.log('3. Database has been deleted');
      console.log('4. Network/firewall blocking connection');
    }
    
    await client.end().catch(() => {});
    process.exit(1);
  }
}

testConnection();
