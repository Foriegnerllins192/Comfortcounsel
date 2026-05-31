// Run this to update the admin password in the database
// Usage: node update-admin-password.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, initDB } = require('./server/database');

(async () => {
  try {
    await initDB();
    
    const email = process.env.ADMIN_EMAIL || 'admin@comfortcounsel.com';
    const password = 'admin123'; // New password
    const hashed = await bcrypt.hash(password, 10);

    // Check if admin exists
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    
    if (exists.rows.length === 0) {
      console.log('❌ Admin user not found. Creating new admin...');
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,'admin')",
        ['Admin', email, hashed]
      );
      console.log(`✅ Admin created: ${email} with password: admin123`);
    } else {
      // Update existing admin password
      await pool.query(
        'UPDATE users SET password=$1 WHERE email=$2',
        [hashed, email]
      );
      console.log(`✅ Admin password updated for: ${email}`);
      console.log(`   New password: admin123`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating admin password:', error.message);
    process.exit(1);
  }
})();
