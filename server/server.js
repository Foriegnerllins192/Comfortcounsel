require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./database');

const app = express();

app.use(cors());
app.use(express.json());

// Routes — registered BEFORE static so API calls are never intercepted
app.use('/api', require('./routes/auth'));
app.use('/api/counselors', require('./routes/counselors'));
app.use('/api', require('./routes/sessions'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/hotline', require('./routes/hotline'));

// Static files after API routes
app.use(express.static(path.join(__dirname, '../public')));

// Serve frontend for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3000;

// Track if database is connected
let isDatabaseConnected = false;

// Background job to handle expired sessions
const handleExpiredSessions = async () => {
  // Skip if database is not connected
  if (!isDatabaseConnected) {
    return;
  }

  const { pool } = require('./database');
  try {
    // Find sessions that have expired but are not yet cancelled
    const expiredSessions = await pool.query(
      `SELECT s.id, s.counselor_id 
       FROM sessions s
       WHERE s.expires_at < NOW() 
         AND s.session_status IN ('scheduled', 'active')
         AND s.payment_status = 'paid'`
    );

    if (expiredSessions.rows.length > 0) {
      console.log(`[EXPIRATION] Found ${expiredSessions.rows.length} expired sessions`);
      
      for (const session of expiredSessions.rows) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          // Update session status to cancelled
          await client.query(
            "UPDATE sessions SET session_status='cancelled' WHERE id=$1",
            [session.id]
          );
          
          // Set counselor availability to true
          await client.query(
            'UPDATE counselors SET is_available=TRUE WHERE id=$1',
            [session.counselor_id]
          );
          
          await client.query('COMMIT');
          console.log(`[EXPIRATION] Session #${session.id} cancelled and counselor freed`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`[EXPIRATION ERROR] Session #${session.id}:`, err.message);
        } finally {
          client.release();
        }
      }
    }
  } catch (err) {
    // Only log database errors if we thought we were connected
    if (isDatabaseConnected) {
      console.error('[EXPIRATION JOB ERROR]', err.message);
      isDatabaseConnected = false; // Mark as disconnected
    }
  }
};

// Run expiration check every 2 minutes
setInterval(handleExpiredSessions, 2 * 60 * 1000);

// Start server immediately, initialize DB in background
app.listen(PORT, () => {
  console.log(`✅ Comfort Counsel server running on http://localhost:${PORT}`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin.html`);
  console.log(`🏠 Home Page: http://localhost:${PORT}`);
  console.log('');
  console.log('Initializing database in background...');
  
  // Initialize database in background (non-blocking)
  initDB()
    .then(() => {
      console.log('✅ Database ready');
      isDatabaseConnected = true;
      // Run expiration check once after DB is ready
      handleExpiredSessions();
    })
    .catch(err => {
      console.error('⚠️  Database initialization failed:', err.message);
      console.error('Server is running but database features may not work.');
      console.error('');
      console.error('To fix this:');
      console.error('1. Run diagnostic: node test-db-diagnostic.js');
      console.error('2. Or try mobile hotspot (fastest fix)');
      console.error('3. Or wake database at: https://console.neon.tech/');
      console.error('');
      isDatabaseConnected = false;
    });
});
