// Migration script to add rating and price columns to counselors table
require('dotenv').config();
const { pool } = require('./server/database');

async function migrate() {
  console.log('🔄 Starting migration: Adding rating and price columns...');
  
  try {
    // Add rating column
    console.log('Adding rating column...');
    await pool.query(`
      ALTER TABLE counselors 
      ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5)
    `);
    console.log('✅ Rating column added');
    
    // Add price column
    console.log('Adding price column...');
    await pool.query(`
      ALTER TABLE counselors 
      ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 80.00
    `);
    console.log('✅ Price column added');
    
    // Update existing counselors with default prices based on tier
    console.log('Updating existing counselor prices...');
    await pool.query(`
      UPDATE counselors 
      SET price = CASE 
        WHEN subscription_tier = 'basic' THEN 80.00
        WHEN subscription_tier = 'standard' THEN 150.00
        WHEN subscription_tier = 'premium' THEN 250.00
        ELSE 80.00
      END
      WHERE price IS NULL OR price = 0
    `);
    console.log('✅ Prices updated');
    
    // Add indexes
    console.log('Adding indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_counselors_rating ON counselors(rating)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_counselors_price ON counselors(price)
    `);
    console.log('✅ Indexes added');
    
    // Display updated counselors
    console.log('\n📊 Updated counselors:');
    const result = await pool.query(`
      SELECT id, user_id, category, subscription_tier, rating, price, status 
      FROM counselors 
      ORDER BY id
    `);
    
    console.table(result.rows);
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
