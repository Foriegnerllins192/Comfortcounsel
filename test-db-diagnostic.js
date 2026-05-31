/**
 * COMPREHENSIVE DATABASE CONNECTION DIAGNOSTIC TOOL
 * 
 * This script performs deep diagnostics to identify the EXACT root cause
 * of database connection issues.
 */

const { Client } = require('pg');
const dns = require('dns').promises;
const net = require('net');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  section: (msg) => console.log(`\n${colors.cyan}${colors.bright}${'='.repeat(60)}${colors.reset}`),
  title: (msg) => console.log(`${colors.cyan}${colors.bright}${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${colors.green}${msg}${colors.reset}`),
  error: (msg) => console.error(`${colors.red}✗${colors.reset} ${colors.red}${msg}${colors.reset}`),
  warn: (msg) => console.warn(`${colors.yellow}⚠${colors.reset} ${colors.yellow}${msg}${colors.reset}`),
  data: (label, value) => console.log(`  ${colors.magenta}${label}:${colors.reset} ${value}`)
};

/**
 * STEP 1: ENV VALIDATION
 */
async function validateEnvironment() {
  log.section();
  log.title('STEP 1: ENVIRONMENT VALIDATION');
  log.section();
  
  // Load dotenv
  require('dotenv').config();
  
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    log.error('DATABASE_URL is undefined!');
    log.warn('Check that .env file exists and contains DATABASE_URL');
    return null;
  }
  
  log.success('DATABASE_URL is defined');
  
  // Mask password for safe logging
  const maskedUrl = dbUrl.replace(/:([^@]+)@/, ':****@');
  log.data('DATABASE_URL', maskedUrl);
  
  return dbUrl;
}

/**
 * STEP 2: CONNECTION STRING VALIDATION
 */
function validateConnectionString(dbUrl) {
  log.section();
  log.title('STEP 2: CONNECTION STRING VALIDATION');
  log.section();
  
  const checks = {
    hasPooler: dbUrl.includes('pooler'),
    hasSSL: dbUrl.includes('sslmode=require'),
    hasProtocol: dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://'),
    hasHost: /@([^/]+)\//.test(dbUrl)
  };
  
  log.data('Contains "pooler"', checks.hasPooler ? '✓ Yes' : '✗ No (WARNING: Direct connection may be slower)');
  log.data('Contains "sslmode=require"', checks.hasSSL ? '✓ Yes' : '✗ No (REQUIRED for Neon)');
  log.data('Has valid protocol', checks.hasProtocol ? '✓ Yes' : '✗ No');
  log.data('Has host', checks.hasHost ? '✓ Yes' : '✗ No');
  
  // Extract host
  const hostMatch = dbUrl.match(/@([^/]+)\//);
  const host = hostMatch ? hostMatch[1].split(':')[0] : null;
  
  if (host) {
    log.data('Extracted host', host);
  }
  
  if (!checks.hasSSL) {
    log.error('CRITICAL: sslmode=require is missing!');
    log.warn('Neon requires SSL. Add "?sslmode=require" to your DATABASE_URL');
    return { valid: false, host: null };
  }
  
  if (!checks.hasProtocol || !checks.hasHost) {
    log.error('CRITICAL: Invalid connection string format!');
    return { valid: false, host: null };
  }
  
  log.success('Connection string format is valid');
  return { valid: true, host };
}

/**
 * STEP 3: DNS RESOLUTION TEST
 */
async function testDNS(host) {
  log.section();
  log.title('STEP 3: DNS RESOLUTION TEST');
  log.section();
  
  if (!host) {
    log.error('No host to test');
    return null;
  }
  
  try {
    log.info(`Resolving DNS for: ${host}`);
    const addresses = await dns.resolve4(host);
    
    log.success(`DNS resolution successful`);
    log.data('IP addresses', addresses.join(', '));
    
    return addresses[0];
  } catch (err) {
    log.error(`DNS resolution failed: ${err.code || err.message}`);
    
    if (err.code === 'ENOTFOUND') {
      log.warn('DIAGNOSIS: DNS cannot resolve hostname');
      log.warn('Possible causes:');
      console.log('  • No internet connection');
      console.log('  • DNS server issues');
      console.log('  • Incorrect hostname in DATABASE_URL');
    }
    
    return null;
  }
}

/**
 * STEP 4: TCP CONNECTION TEST
 */
async function testTCP(host, port = 5432) {
  log.section();
  log.title('STEP 4: TCP CONNECTION TEST');
  log.section();
  
  if (!host) {
    log.error('No host to test');
    return false;
  }
  
  return new Promise((resolve) => {
    log.info(`Testing TCP connection to ${host}:${port}...`);
    
    const socket = new net.Socket();
    const timeout = 10000; // 10 seconds
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      log.success(`TCP connection successful to ${host}:${port}`);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      log.error(`TCP connection timeout after ${timeout}ms`);
      log.warn('DIAGNOSIS: Network is blocking PostgreSQL connection');
      log.warn('Possible causes:');
      console.log('  • Firewall blocking port 5432');
      console.log('  • ISP blocking database connections');
      console.log('  • Corporate network restrictions');
      console.log('  • VPN interference');
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', (err) => {
      log.error(`TCP connection failed: ${err.code || err.message}`);
      
      if (err.code === 'ECONNREFUSED') {
        log.warn('DIAGNOSIS: Connection refused');
        log.warn('Possible causes:');
        console.log('  • Database server is down');
        console.log('  • Wrong port number');
        console.log('  • Firewall blocking connection');
      } else if (err.code === 'ETIMEDOUT') {
        log.warn('DIAGNOSIS: Connection timeout');
        log.warn('Possible causes:');
        console.log('  • Network blocking port 5432');
        console.log('  • ISP restrictions');
        console.log('  • Firewall rules');
      }
      
      socket.destroy();
      resolve(false);
    });
    
    socket.connect(port, host);
  });
}

/**
 * STEP 5: POSTGRESQL CONNECTION TEST
 */
async function testPostgreSQLConnection(dbUrl) {
  log.section();
  log.title('STEP 5: POSTGRESQL CONNECTION TEST');
  log.section();
  
  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000
  });
  
  try {
    log.info('Attempting PostgreSQL connection...');
    await client.connect();
    log.success('PostgreSQL connection established!');
    
    // Test query
    log.info('Running test query: SELECT NOW()...');
    const result = await client.query('SELECT NOW() as time, version() as version');
    
    log.success('Query executed successfully!');
    log.data('Server time', result.rows[0].time);
    log.data('PostgreSQL version', result.rows[0].version.split(' ').slice(0, 2).join(' '));
    
    await client.end();
    return true;
    
  } catch (err) {
    log.error(`PostgreSQL connection failed!`);
    log.data('Error code', err.code || 'N/A');
    log.data('Error message', err.message);
    
    // Classify error
    if (err.message.includes('timeout')) {
      log.warn('DIAGNOSIS: Connection timeout');
      log.warn('Root causes:');
      console.log('  • Network is blocking PostgreSQL traffic (most likely)');
      console.log('  • ISP blocking port 5432');
      console.log('  • Firewall rules preventing connection');
      console.log('  • VPN interfering with connection');
    } else if (err.code === 'ENOTFOUND') {
      log.warn('DIAGNOSIS: DNS resolution failed');
      log.warn('Root causes:');
      console.log('  • No internet connection');
      console.log('  • Incorrect hostname in DATABASE_URL');
    } else if (err.code === 'ECONNREFUSED') {
      log.warn('DIAGNOSIS: Connection refused');
      log.warn('Root causes:');
      console.log('  • Database is sleeping (Neon free tier)');
      console.log('  • Database server is down');
      console.log('  • Wrong port or host');
    } else if (err.message.includes('password') || err.message.includes('authentication')) {
      log.warn('DIAGNOSIS: Authentication failed');
      log.warn('Root causes:');
      console.log('  • Incorrect password in DATABASE_URL');
      console.log('  • User does not exist');
      console.log('  • Database access permissions');
    } else {
      log.warn('DIAGNOSIS: Unknown error');
      log.warn('Full error details:');
      console.error(err);
    }
    
    try {
      await client.end();
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return false;
  }
}

/**
 * STEP 6: RECOMMENDATIONS
 */
function provideRecommendations(results) {
  log.section();
  log.title('DIAGNOSTIC SUMMARY & RECOMMENDATIONS');
  log.section();
  
  console.log('\n📊 Test Results:');
  log.data('Environment validation', results.env ? '✓ Pass' : '✗ Fail');
  log.data('Connection string format', results.connString ? '✓ Pass' : '✗ Fail');
  log.data('DNS resolution', results.dns ? '✓ Pass' : '✗ Fail');
  log.data('TCP connection', results.tcp ? '✓ Pass' : '✗ Fail');
  log.data('PostgreSQL connection', results.postgres ? '✓ Pass' : '✗ Fail');
  
  console.log('\n💡 Recommendations:\n');
  
  if (!results.env) {
    console.log('1. Fix .env file:');
    console.log('   • Ensure .env file exists in project root');
    console.log('   • Add DATABASE_URL variable');
    console.log('');
  }
  
  if (!results.connString) {
    console.log('2. Fix DATABASE_URL format:');
    console.log('   • Must include "?sslmode=require"');
    console.log('   • Format: postgresql://user:pass@host/db?sslmode=require');
    console.log('');
  }
  
  if (!results.dns) {
    console.log('3. Fix DNS/Internet:');
    console.log('   • Check internet connection');
    console.log('   • Try: ping 8.8.8.8');
    console.log('   • Verify hostname in DATABASE_URL');
    console.log('');
  }
  
  if (results.dns && !results.tcp) {
    console.log('4. Network is blocking PostgreSQL (PORT 5432):');
    console.log('   ⚠️  THIS IS LIKELY YOUR ISSUE!');
    console.log('');
    console.log('   Solutions:');
    console.log('   a) Switch to mobile hotspot (bypass ISP restrictions)');
    console.log('   b) Use a VPN (bypass network restrictions)');
    console.log('   c) Contact ISP about port 5432 blocking');
    console.log('   d) Try different network (coffee shop, library, etc.)');
    console.log('');
    console.log('   Why this happens:');
    console.log('   • Some ISPs block database ports for security');
    console.log('   • Corporate networks often restrict outbound connections');
    console.log('   • Public WiFi may have firewall rules');
    console.log('');
  }
  
  if (results.tcp && !results.postgres) {
    console.log('5. PostgreSQL-specific issue:');
    console.log('   • Database may be sleeping (Neon free tier)');
    console.log('   • Wake it at: https://console.neon.tech/');
    console.log('   • Check credentials in DATABASE_URL');
    console.log('   • Verify SSL settings');
    console.log('');
  }
  
  if (results.postgres) {
    log.success('✅ ALL TESTS PASSED!');
    console.log('\nYour database connection is working correctly.');
    console.log('If you still have issues in your app, check:');
    console.log('  • Application code for errors');
    console.log('  • Connection pool configuration');
    console.log('  • Query syntax');
    console.log('');
  }
}

/**
 * MAIN DIAGNOSTIC ROUTINE
 */
async function runDiagnostics() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     DATABASE CONNECTION DIAGNOSTIC TOOL                    ║');
  console.log('║     Comprehensive Root Cause Analysis                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);
  
  const results = {
    env: false,
    connString: false,
    dns: false,
    tcp: false,
    postgres: false
  };
  
  try {
    // Step 1: Validate environment
    const dbUrl = await validateEnvironment();
    results.env = !!dbUrl;
    
    if (!dbUrl) {
      provideRecommendations(results);
      process.exit(1);
    }
    
    // Step 2: Validate connection string
    const { valid, host } = validateConnectionString(dbUrl);
    results.connString = valid;
    
    if (!valid) {
      provideRecommendations(results);
      process.exit(1);
    }
    
    // Step 3: Test DNS
    const ip = await testDNS(host);
    results.dns = !!ip;
    
    // Step 4: Test TCP (even if DNS failed, try with host)
    if (host) {
      results.tcp = await testTCP(host);
    }
    
    // Step 5: Test PostgreSQL connection
    results.postgres = await testPostgreSQLConnection(dbUrl);
    
    // Step 6: Provide recommendations
    provideRecommendations(results);
    
    process.exit(results.postgres ? 0 : 1);
    
  } catch (err) {
    log.error('Unexpected error during diagnostics:');
    console.error(err);
    process.exit(1);
  }
}

// Run diagnostics
runDiagnostics();
