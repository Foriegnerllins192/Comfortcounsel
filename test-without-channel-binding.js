/**
 * TEST CONNECTION WITHOUT CHANNEL_BINDING
 * This test removes channel_binding=require to see if that's the root cause
 */

require('dotenv').config();
const { Client } = require('pg');

async function testBothConnections() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TESTING: channel_binding=require hypothesis');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const originalUrl = process.env.DATABASE_URL;
  const fixedUrl = originalUrl.replace(/[&?]channel_binding=require/g, '');
  
  console.log('Original URL (masked):', originalUrl.replace(/:([^@]+)@/, ':****@'));
  console.log('Fixed URL (masked):', fixedUrl.replace(/:([^@]+)@/, ':****@'));
  console.log('');
  
  // Test 1: WITH channel_binding=require
  console.log('TEST 1: Connection WITH channel_binding=require');
  console.log('─────────────────────────────────────────────────────');
  const client1 = new Client({
    connectionString: originalUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });
  
  const start1 = Date.now();
  try {
    console.log('Connecting... (timeout: 30s)');
    await client1.connect();
    const duration1 = Date.now() - start1;
    
    console.log(`✓ Connected in ${duration1}ms`);
    const result = await client1.query('SELECT NOW()');
    console.log(`✓ Query successful: ${result.rows[0].now}`);
    await client1.end();
    
  } catch (err) {
    const duration1 = Date.now() - start1;
    console.log(`✗ Failed after ${duration1}ms`);
    console.log(`✗ Error: ${err.message}`);
    await client1.end().catch(() => {});
  }
  
  console.log('');
  
  // Test 2: WITHOUT channel_binding=require
  console.log('TEST 2: Connection WITHOUT channel_binding=require');
  console.log('─────────────────────────────────────────────────────');
  const client2 = new Client({
    connectionString: fixedUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000
  });
  
  const start2 = Date.now();
  try {
    console.log('Connecting... (timeout: 30s)');
    await client2.connect();
    const duration2 = Date.now() - start2;
    
    console.log(`✓ Connected in ${duration2}ms`);
    const result = await client2.query('SELECT NOW()');
    console.log(`✓ Query successful: ${result.rows[0].now}`);
    await client2.end();
    
  } catch (err) {
    const duration2 = Date.now() - start2;
    console.log(`✗ Failed after ${duration2}ms`);
    console.log(`✗ Error: ${err.message}`);
    await client2.end().catch(() => {});
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  CONCLUSION');
  console.log('═══════════════════════════════════════════════════════');
  console.log('If TEST 1 fails and TEST 2 succeeds:');
  console.log('  → channel_binding=require is the root cause');
  console.log('');
  console.log('If BOTH tests fail:');
  console.log('  → Database is sleeping or network issue');
  console.log('  → Wake database at https://console.neon.tech/');
  console.log('');
  console.log('If BOTH tests succeed:');
  console.log('  → Bug may have been fixed already');
  console.log('═══════════════════════════════════════════════════════');
}

testBothConnections().then(() => process.exit(0)).catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
