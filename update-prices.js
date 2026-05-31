// Update counselor prices based on tier
require('dotenv').config();
const { pool } = require('./server/database');

async function updatePrices() {
  try {
    console.log('🔄 Updating counselor prices based on tier...');
    
    await pool.query(`
      UPDATE counselors 
      SET price = CASE 
        WHEN subscription_tier = 'basic' THEN 80.00
        WHEN subscription_tier = 'standard' THEN 150.00
        WHEN subscription_tier = 'premium' THEN 250.00
        ELSE 80.00
      END
    `);
    
    const result = await pool.query(`
      SELECT id, category, subscription_tier, rating, price, status 
      FROM counselors 
      ORDER BY id
    `);
    
    console.log('\n📊 Updated counselor prices:');
    console.table(result.rows);
    
    console.log('\n✅ Prices updated successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    process.exit(1);
  }
}

updatePrices();
