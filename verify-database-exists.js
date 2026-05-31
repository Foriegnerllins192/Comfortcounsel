/**
 * VERIFY DATABASE EXISTS
 * This script helps you verify if your database still exists
 */

require('dotenv').config();

console.log('\n=== DATABASE VERIFICATION ===\n');

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.log('❌ DATABASE_URL is not set in .env file');
  process.exit(1);
}

// Extract database details
const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)/);

if (!match) {
  console.log('❌ DATABASE_URL format is invalid');
  process.exit(1);
}

const [, username, password, host, database] = match;

console.log('✅ DATABASE_URL is loaded from .env file\n');
console.log('Database Details:');
console.log(`  Username: ${username}`);
console.log(`  Password: ${password.substring(0, 4)}****`);
console.log(`  Host: ${host}`);
console.log(`  Database: ${database}`);
console.log('');

// Extract project ID from host
const projectMatch = host.match(/ep-([^-]+)-([^-]+)-([^.]+)/);
if (projectMatch) {
  const projectId = `ep-${projectMatch[1]}-${projectMatch[2]}-${projectMatch[3]}`;
  console.log(`Project ID: ${projectId}`);
  console.log('');
}

console.log('=== NEXT STEPS ===\n');
console.log('1. Go to: https://console.neon.tech/');
console.log('2. Log in to your account');
console.log(`3. Look for project: ${host.split('.')[0]}`);
console.log('');
console.log('IF YOU SEE THE DATABASE:');
console.log('  → Click on it to wake it up');
console.log('  → Wait 30 seconds');
console.log('  → Restart your server: npm start');
console.log('');
console.log('IF YOU DON\'T SEE THE DATABASE:');
console.log('  → It was deleted');
console.log('  → Create a new database');
console.log('  → Update DATABASE_URL in .env file');
console.log('  → Restart your server: npm start');
console.log('');
