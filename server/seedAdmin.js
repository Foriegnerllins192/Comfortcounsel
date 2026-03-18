// Run once: node server/seedAdmin.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, initDB } = require('./database');

(async () => {
  await initDB();
  const email = process.env.ADMIN_EMAIL || 'admin@comfortcounsel.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const hashed = await bcrypt.hash(password, 10);

  const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
  if (exists.rows.length) {
    console.log('Admin already exists');
  } else {
    await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,'admin')",
      ['Admin', email, hashed]
    );
    console.log(`Admin created: ${email}`);
  }
  process.exit(0);
})();
