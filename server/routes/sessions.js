const router = require('express').Router();
const { pool } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  initiateBooking, verifyPayment, paystackWebhook,
  getUserSessions, getActiveSession, completeSession, getWallet
} = require('../controllers/bookingController');
const {
  getCounselorStatus, startSessionCall, hubtelWebhook
} = require('../controllers/callController');

router.post('/book', authenticate, initiateBooking);
router.get('/verify/:reference', authenticate, verifyPayment);
router.get('/my-sessions', authenticate, getUserSessions);
router.get('/active-session', authenticate, getActiveSession);
router.post('/webhook/paystack', paystackWebhook);
router.patch('/sessions/:session_id/complete', authenticate, requireRole('counselor'), completeSession);
router.patch('/:session_id/complete', authenticate, requireRole('counselor'), completeSession);
router.get('/wallet', authenticate, getWallet);

// Call system routes
router.get('/counselor/:id/status', getCounselorStatus);
router.post('/start-session-call', authenticate, requireRole('counselor'), startSessionCall);
router.post('/hubtel/webhook', hubtelWebhook);

// Get single session by ID
router.get('/:session_id', authenticate, async (req, res) => {
  const { session_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT s.*, u.name as counselor_name, c.phone_number as counselor_number, c.category as counselor_category
       FROM sessions s
       JOIN counselors c ON s.counselor_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE s.id = $1 AND s.user_id = $2`,
      [session_id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
