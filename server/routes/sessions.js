const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  initiateBooking, verifyPayment, paystackWebhook,
  getUserSessions, getActiveSession, completeSession, getWallet
} = require('../controllers/bookingController');

router.post('/book-session', authenticate, initiateBooking);
router.get('/verify/:reference', authenticate, verifyPayment);
router.get('/my-sessions', authenticate, getUserSessions);
router.get('/active-session', authenticate, getActiveSession); // Feature 2: hotline after payment
router.post('/webhook/paystack', paystackWebhook);
router.patch('/sessions/:session_id/complete', authenticate, requireRole('counselor'), completeSession);
router.get('/wallet', authenticate, getWallet);

module.exports = router;
